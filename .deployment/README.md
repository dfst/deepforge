# Deployment Files
This directory contains customizations to the standard deployment settings to accommodate the deployment machine.

The script `deploy-deepforge` is used for standard deployment of deepforge using github actions.

Additionally, this contains a file with customizations to the standard docker-compose.yml file which allows us to modify the entrypoint and install a version of tensorflow [compatible with the CPU of the deployment machine](https://github.com/deepforge-dev/deepforge/issues/1561).

Moreover, we also host a proxy server that spins up different language servers that we provide for intelligent syntax highlighting in DeepForge's browser based text editor. For more information checkout the language server's docker [file](../docker/Dockerfile.langservers). We use [jq](https://stedolan.github.io/jq/manual/) to update [components.json](../config/components.json) to include available language servers' configuration.

The deployment is updated by first creating the custom docker compose file using [yq](https://github.com/mikefarah/yq):
```
yq m -a docker/docker-compose.yml "$DEEPFORGE_DEPLOYMENT_DIR"/docker-compose-overrides.yml > custom-docker-compose.yml
```
Next, the generated file can be used with docker-compose:
```
docker-compose --file custom-docker-compose.yml up
```
