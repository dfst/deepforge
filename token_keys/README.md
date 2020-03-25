# Public/Private Keys for Production
This directory will contain the public and private keys used for signing the JWTs. After creation, these keys **must** be moved out of the project root to ensure they will not be served as static files by the server.

After moving the keys to another location, set the `DEEPFORGE_PRIVATE_KEY` and `DEEPFORGE_PUBLIC_KEY` environment variables to the paths to the given key.
