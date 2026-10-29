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
- 512 item limit. Each node is its own item (`links-v2:<id>`), so this is now the limit that binds:
  the list holds at most 509 nodes, leaving room for `settings-v1`, the `links-v2` marker, and the
  `links-v1` backup.
- 100kb limit across all keys, including key names. A key's size is its length plus the value's
  JSON in UTF-8 bytes (`"👉"` counts 6). Nodes would have to average about 180 bytes before this
  binds ahead of the item limit.
- 8kb limit per key. Up to 2.1.0 the whole list lived in one key (`links-v1`), which capped it at
  roughly 60 to 120 nodes depending on how many were links. Now it only caps a single node.

Measured in Chromium (Chrome 153):
- `set()` with several keys is all-or-nothing: if one key is over quota, none are written.
- `set()` and `remove()` are separate calls, so a save that does both isn't atomic, and other
  tabs get two `onChanged` events. One `set()` arrives as a single event with every key in it.
- Writes to a key that don't change its value fire no `onChanged` event.
- `null` is a storable value (4 bytes plus the key).

Rate limits: `MAX_WRITE_OPERATIONS_PER_MINUTE` is 120 and `MAX_WRITE_OPERATIONS_PER_HOUR` is 1800.
They count calls, not keys: the 121st `set()` within a minute fails whether each call wrote one
key or twenty, and so do writes that change nothing. Each edit is one call, so this is far off.

```js
// There are a couple helpers provided that help determine your quota usage
await chrome.storage.sync.getBytesInUse()
1982 (example)
await chrome.storage.sync.getBytesInUse('settings-v1')
95 (example)
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