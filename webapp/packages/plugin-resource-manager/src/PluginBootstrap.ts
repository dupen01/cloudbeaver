/*
 * CloudBeaver - Cloud Database Manager
 * Copyright (C) 2020-2022 DBeaver Corp and others
 *
 * Licensed under the Apache License, Version 2.0.
 * you may not use this file except in compliance with the License.
 */

import { DATA_CONTEXT_NAV_NODE, EMainMenu, MainMenuService } from '@cloudbeaver/core-app';
import { AuthInfoService } from '@cloudbeaver/core-authentication';
import { Bootstrap, injectable } from '@cloudbeaver/core-di';
import { CommonDialogService, ConfirmationDialogDelete, DialogueStateResult } from '@cloudbeaver/core-dialogs';
import { SideBarPanelService } from '@cloudbeaver/core-ui';
import { ActionService, MenuService } from '@cloudbeaver/core-view';
import { isScript } from '@cloudbeaver/plugin-sql-editor-navigation-tab-resource';

import { ACTION_DELETE_RESOURCE } from './actions/ACTION_DELETE_RESOURCE';
import { NavResourceNodeService, PROJECT_NODE_TYPE, RESOURCE_NODE_TYPE } from './NavResourceNodeService';
import { ResourceManager } from './ResourceManager';
import { ResourceManagerService } from './ResourceManagerService';

@injectable()
export class PluginBootstrap extends Bootstrap {
  constructor(
    private readonly mainMenuService: MainMenuService,
    private readonly authInfoService: AuthInfoService,
    private readonly resourceManagerService: ResourceManagerService,
    private readonly sideBarPanelService: SideBarPanelService,
    private readonly navResourceNodeService: NavResourceNodeService,
    private readonly commonDialogService: CommonDialogService,
    private readonly actionService: ActionService,
    private readonly menuService: MenuService
  ) {
    super();
  }

  register(): void | Promise<void> {
    this.mainMenuService.registerMenuItem(
      EMainMenu.mainMenuToolsPanel,
      {
        id: 'resourceManagementTrigger',
        order: 3,
        type: 'checkbox',
        title: 'plugin_resource_manager_title',
        isHidden: () => !this.authInfoService.userInfo,
        isChecked: () => this.resourceManagerService.enabled,
        onClick: this.resourceManagerService.toggleEnabled,
      }
    );

    this.sideBarPanelService.tabsContainer.add({
      key: 'resource-manager-tab',
      order: 0,
      name: 'plugin_resource_manager_title',
      isHidden: () => !this.authInfoService.userInfo || !this.resourceManagerService.enabled,
      onClose: this.resourceManagerService.toggleEnabled,
      panel: () => ResourceManager,
    });

    this.actionService.addHandler({
      id: 'resource-manager-base-actions',
      isActionApplicable: (context, action) => {
        if (!context.has(DATA_CONTEXT_NAV_NODE)) {
          return false;
        }

        const node = context.get(DATA_CONTEXT_NAV_NODE);

        if (action === ACTION_DELETE_RESOURCE) {
          return isScript(node.id);
        }

        return false;
      },
      handler: async (context, action) => {
        const node = context.get(DATA_CONTEXT_NAV_NODE);

        if (action === ACTION_DELETE_RESOURCE) {
          const result = await this.commonDialogService.open(ConfirmationDialogDelete, {
            title: 'ui_data_delete_confirmation',
            message: `You are going to delete "${node.name}". Are you sure?`,
            confirmActionText: 'ui_delete',
          });

          if (result === DialogueStateResult.Resolved) {
            this.navResourceNodeService.delete(node.id);
          }
        }
      },
    });

    this.menuService.addCreator({
      isApplicable: context => {
        const node = context.tryGet(DATA_CONTEXT_NAV_NODE);
        return !!node?.nodeType && [PROJECT_NODE_TYPE, RESOURCE_NODE_TYPE].includes(node.nodeType);
      },
      getItems: (context, items) => [
        ...items,
        ACTION_DELETE_RESOURCE,
      ],
    });
  }

  async load(): Promise<void> { }
}