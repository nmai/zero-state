# Notes

## Chrome Storage Sync API

Magical API that abstracts away all of the "sync" behavior. Sync only comes into play when the user is signed into their Google account in their browser profile.

Other chromium browsers can use this API too although I haven't tested whether the sync behavior is actually implemented. I'd assume MS Edge has implemented it but not sure about others (brave, vivaldi, etc).

### Limitations
```js
chrome.storage.sync.MAX_ITEMS
512

chrome.storage.sync.QUOTA_BYTES
102400

chrome.storage.sync.QUOTA_BYTES_PER_ITEM
8192
```

This breaks down to:
- 512 item limit. This is generous for our needs.
  I only see this breaking if we implement an "archive" feature.
- 100kb limit across all keys, including key names.
- 8kb limit per key. Doesn't seem like much until you consider that all nodes are currently stored in a single key (links-v1) and we haven't hit the limit yet.

There are rate limits too but nothing that will ever affect this project.

```js
// There are a couple helpers provided that help determine your quota usage
await chrome.storage.sync.getBytesInUse()
1982 (example)
await chrome.storage.sync.getBytesInUse('links-v1')
1895 (example)
```

### Other functions
```
get
getKeys
set
remove
clear
// Event listener
onChanged
```