# Devlog

## Kinto setup
- Local docker with kinto `10.1.2` & memory backend: Failed with unauthorized error
- Local docker with kinto 18 & memory backend: Failed with forbidden error
- alwaysdata
  - Challenges downgrading to correct version
    - Uninstall all packages reinstall versions from 2018.
    - regenerate config file, replace w/ proper postgres url
    - Got 503 server error, column `collection_id` does not exist
  - Then tried remote postgres, local kinto `10.1.2` to the same issue
