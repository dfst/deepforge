# Deployment Files
This directory contains customizations to the standard deployment settings to accommodate the deployment machine.

The script `deploy-deepforge` is used for standard deployment of deepforge using github actions.

Additionally, this contains a file with customizations to the standard docker-compose.yml file which allows us to modify the entrypoint and install a version of tensorflow [compatible with the CPU of the deployment machine](https://github.com/deepforge-dev/deepforge/issues/1561).

The deployment is updated by first creating the custom docker compose file using [yaml-merge](https://github.com/alexlafroscia/yaml-merge):
```
yaml-merge docker-compose.yml .deployment/docker-compose-overrides.yml > custom-docker-compose.yml
```
Next, the generated file can be used with docker-compose:
```
docker-compose --file custom-docker-compose.yml up
```
