set -ex

docker buildx create --name=container --driver=docker-container --use --bootstrap

docker build \
  --builder=container \
  --platform=linux/amd64,linux/arm64 \
  -t $REGISTRY/duperl/cloudbeaver \
  --push \
  -f docker/cloudbeaver-ce/Dockerfile .
