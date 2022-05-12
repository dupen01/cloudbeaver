/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { INodeNavigationData, NavigationTabsService, NavNodeInfoResource, NavNodeManagerService } from '@cloudbeaver/core-app';
import { Bootstrap, injectable } from '@cloudbeaver/core-di';
import { CommonDialogService, DialogueStateResult } from '@cloudbeaver/core-dialogs';
import { NotificationService } from '@cloudbeaver/core-events';
import { ActionService, DATA_CONTEXT_MENU, MenuService } from '@cloudbeaver/core-view';
import { ACTION_SAVE_SCRIPT, NavResourceNodeService, RESOURCE_NODE_TYPE, SaveScriptDialog, ResourceManagerService, ProjectsResource, RESOURCES_NODE_PATH } from '@cloudbeaver/plugin-resource-manager';
import { DATA_CONTEXT_SQL_EDITOR_STATE, SqlEditorService, SQL_EDITOR_ACTIONS_MENU } from '@cloudbeaver/plugin-sql-editor';
import { SqlEditorNavigatorService, SqlEditorTabService } from '@cloudbeaver/plugin-sql-editor-navigation-tab';

import { isScript } from './isScript';
import { SCRIPT_EXTENSION } from './SCRIPT_EXTENSION';
import { SqlEditorTabResourceService } from './SqlEditorTabResourceService';

@injectable()
export class PluginBootstrap extends Bootstrap {
  constructor(
    private readonly navNodeManagerService: NavNodeManagerService,
    private readonly navResourceNodeService: NavResourceNodeService,
    private readonly sqlEditorTabService: SqlEditorTabService,
    private readonly sqlEditorService: SqlEditorService,
    private readonly navNodeInfoResource: NavNodeInfoResource,
    private readonly navigationTabsService: NavigationTabsService,
    private readonly notificationService: NotificationService,
    private readonly sqlEditorNavigatorService: SqlEditorNavigatorService,
    private readonly resourceManagerService: ResourceManagerService,
    private readonly projectsResource: ProjectsResource,
    private readonly sqlEditorTabResourceService: SqlEditorTabResourceService,
    private readonly commonDialogService: CommonDialogService,
    private readonly actionService: ActionService,
    private readonly menuService: MenuService,
  ) {
    super();
  }

  register(): void | Promise<void> {
    this.sqlEditorTabResourceService.start();
    this.navNodeManagerService.navigator.addHandler(this.navigationHandler.bind(this));

    this.actionService.addHandler({
      id: 'scripts-base-handler',
      isActionApplicable: (context, action) => context.has(DATA_CONTEXT_SQL_EDITOR_STATE),
      handler: async (context, action) => {
        const state = context.get(DATA_CONTEXT_SQL_EDITOR_STATE);

        if (state.associatedScriptId) {
          try {
            await this.navResourceNodeService.write(state.associatedScriptId, state.query);
            this.notificationService.logSuccess({ title: 'plugin_resource_manager_update_script_success' });
          } catch (exception) {
            this.notificationService.logException(exception as any, 'plugin_resource_manager_update_script_error');
          }
        } else {
          const tabName = this.sqlEditorTabService.getName(state);
          const result = await this.commonDialogService.open(SaveScriptDialog, {
            defaultScriptName: tabName,
          });

          if (result != DialogueStateResult.Rejected && result !== DialogueStateResult.Resolved) {
            try {
              const scriptName = `${result.trim()}.${SCRIPT_EXTENSION}`;
              const projectName = this.projectsResource.userProject?.name;
              const folder = `${RESOURCES_NODE_PATH}${projectName ? '/' + projectName : ''}`;
              const nodeId = await this.navResourceNodeService.saveScript(folder, scriptName, state.query);
              const node = await this.navNodeInfoResource.load(nodeId);

              this.sqlEditorService.setAssociatedScriptId(node.id, state);
              this.sqlEditorService.setName(node.name ?? scriptName, state);
              this.notificationService.logSuccess({ title: 'plugin_resource_manager_save_script_success', message: node.name });

              if (!this.resourceManagerService.enabled) {
                this.resourceManagerService.toggleEnabled();
              }

            } catch (exception) {
              this.notificationService.logException(exception as any, 'plugin_resource_manager_save_script_error');
            }
          }
        }
      },
    });

    this.menuService.addCreator({
      isApplicable: context => context.get(DATA_CONTEXT_MENU) === SQL_EDITOR_ACTIONS_MENU,
      getItems: (context, items) => [
        ...items,
        ACTION_SAVE_SCRIPT,
      ],
    });
  }

  load(): void | Promise<void> { }

  private async navigationHandler(data: INodeNavigationData) {
    try {
      const node = await this.navNodeInfoResource.load(data.nodeId);

      if (node.nodeType !== RESOURCE_NODE_TYPE || !isScript(node.id)) {
        return;
      }

      const existingTab = this.sqlEditorTabService.sqlEditorTabs.find(
        tab => tab.handlerState.associatedScriptId === data.nodeId
      );

      if (existingTab) {
        this.navigationTabsService.selectTab(existingTab.id);
      } else {
        const value = await this.navResourceNodeService.read(data.nodeId);

        await this.sqlEditorNavigatorService.openNewEditor({
          name: node.name ?? 'Unknown script',
          query: value,
          associatedScriptId: data.nodeId,
        });
      }
    } catch (exception) {
      this.notificationService.logException(exception as any, 'plugin_resource_manager_open_script_error');
    }
  }
}