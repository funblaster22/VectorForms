# Devlog

## Kinto setup
- Local docker with kinto `10.1.2` & memory backend: Failed with unauthorized error
- Local docker with kinto 18 & memory backend: Failed with forbidden error
- [alwaysdata](https://www.alwaysdata.com/en/marketplace/kinto/)
  - Challenges downgrading to correct version
    - Uninstall all packages reinstall versions from 2018.
    - regenerate config file, replace w/ proper postgres url
    - Got 503 server error, column `collection_id` does not exist
  - Then tried remote postgres, local kinto `10.1.2` to the same issue

**Resolution**: use kinto 18 via docker, use alwaysdata postgres. Create `formbuilder` bucket in advance via [kinto admin](https://kinto.github.io/kinto-admin/). `cd` to this directory, then run
```bash
docker run --env-file ./kinto.env -p 8888:8888 kinto/kinto-server
```
