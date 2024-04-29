'use strict'

/**
 * LinkNodeFlat:
 * name: string
 * url?: string
 * parent?: string
 * 
 * LinkNode:
 * name: string
 * url?: string
 * children?: LinkNode[]
 */

const CURRENT_LIST_VERSION = 'links-v1'

let toggleFormBtn = document.getElementById('toggle-form-btn')
let form = document.getElementById('newlink-form')
let nameField = document.getElementById('newlink-name')
let urlField = document.getElementById('newlink-url')
let parentField = document.getElementById('newlink-parent')
let listsContainer = document.getElementById('lists-container')
let overlayContainer = document.getElementById('overlay-container')


let formOpen = false;
// pre-processed
let rawList = []
let names = []
// post-processed
let root = {
  name: 'Root',
  children: []
}
let createdTable = {}


// initialization

chrome.storage.sync.get(CURRENT_LIST_VERSION, function (result) {
  console.log('Fetched initial list:', result)
  if (result[CURRENT_LIST_VERSION] == null) {
    save([])
    rawList = []
    names = []
  } else {
    rawList = result[CURRENT_LIST_VERSION]
    names = rawList.map( item => item.name )
  }

  let tree = makeTree(rawList)
  renderTree(tree)
  renderWelcome(rawList.length == 0)
})

// listeners 

toggleFormBtn.addEventListener('click', toggleForm)

form.addEventListener('submit', (e) => {
  e.preventDefault()
  
  // validate
  let errorMessage

  let name = nameField.value.trim()
  let url = urlField.value.trim()
  let parent = parentField.value.trim()

  if (name.length == 0)
    errorMessage = 'Name must be populated'
  else if (!validName(name))
    errorMessage = 'Name already taken'
  else if (url.length > 0 && !validURL(url))
    errorMessage = 'URL format invalid'
  else if (parent.length > 0 && !validParent(parent))
    errorMessage = 'Parent does not exist'

  if (errorMessage) {
    alert(errorMessage)
    return
  }

  // save
  rawList.push({
    name: name,
    url: url || undefined,
    parent: parent || undefined,
  })
  
  toggleForm()
  save(rawList)

  clearForm()
})

chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log(changes, namespace)
  for (let key in changes) {
    switch (key) {
      case CURRENT_LIST_VERSION:
        let list = changes[key].newValue
        rawList = list
        names = list.map( item => item.name )
        // honestly we could just store the list in the structure we want but it's less fun
        // plus to get flat maps of parent names and such, we would have to traverse anyway
        let tree = makeTree(list)
        renderTree(tree)
        renderWelcome(rawList.length == 0)
      break
      default:
        // nothing really to do here, it's an old version of this list. maybe we do "auto migration"
      break
    }
  }
});


// utils

function removeLeaf(node) {
  rawList.splice(rawList.indexOf(node), 1)
  save(rawList)
}

function toggleForm() {
  formOpen = !formOpen

  if (formOpen) {
    toggleFormBtn.innerText = '[\u2212]'
    form.classList.remove('display-none')
  } else {
    toggleFormBtn.innerText = '[+]'
    form.classList.add('display-none')
  }

  renderTree(root)
}

function save(list) {
  // clone to break references
  let cloneList = JSON.parse(JSON.stringify(list))
  // clean
  cloneList.forEach( n => delete n.children )

  chrome.storage.sync.set({[CURRENT_LIST_VERSION]: cloneList}, () => console.log('saved'))
}

// takes an array of LinkNodeFlat and turns it into a tree of LinkNodes
function makeTree(rawList) {
  let cloneList = rawList.slice(0)
  root = {
    name: 'Root',
    children: []
  }
  // simplify into 2 step process: populate all the root nodes first then figure out the rest.
  let nonrootList = []
  for (let item of cloneList) {
    if (item.parent != null)
      nonrootList.unshift(item)
    else
      root.children.push(item)
  }

  // naive implementation
  createdTable = {}
  root.children.forEach(node => {
    createdTable[node.name] = node
  })
  
  let safetyCount = 0
  while (nonrootList.length > 0) {
    if (safetyCount > 2000) {
      console.error('Had to break early during tree construction due to missing parent')
      break
    }
    let node = nonrootList.pop()
    let parent = createdTable[node.parent]

    if (parent) {
      parent.children = parent.children || []
      parent.children.push(node)
      createdTable[node.name] = node
    } else {
      // put it back on the queue if we didn't find the parent node, we will try it again later.
      nonrootList.unshift(node)
    }
    safetyCount++
  }

  return root
}

function renderTree(tree) {
  console.log('Rendering tree', tree)
  // clear old list from dom
  while (listsContainer.firstChild)
    listsContainer.removeChild(listsContainer.lastChild)

  let treeIndex = 0 // refers to the list group number.. i.e. vertical column
  let queue = tree.children.slice(0)
  while (queue.length) {
    let node = queue.shift()
    if (nodeHasChildren(node))
      queue = [...queue, ...node.children]

    let parentEl
    if (!node.parent) {
      // no parent, lets make a new column
      parentEl = htmlToElement(`<ul id="list-group-${treeIndex}" class="tree-list col"></ul>`);
      listsContainer.appendChild(parentEl);
      treeIndex++
    } else {
      // theres a parent, we will attach it there
      parentEl = document.getElementById('listchild-sub-' + node.parent)
    }
    
    let childEl = document.createElement('li')
    childEl.id = 'listchild-' + node.name
    childEl.className = nodeHasChildren(node) ? `tree-item text-parent` : `tree-item text-child`
    let contentNode = node.url
      ? htmlToElement(`<span><a href="${node.url}"><img src="${extractFaviconUrl(node.url)}" class="favicon">${node.name}</a></span>`)
      : htmlToElement(`<span>${node.name}</span>`)
    if (node.taskComplete)
      contentNode.classList.add('text-linethrough')
    childEl.appendChild(contentNode)
    if (formOpen && !nodeHasChildren(node)) {
      let delEl = htmlToElement(`<a href="#">[\u2212]</a>`)
      delEl.addEventListener('click', () => {
        removeLeaf(node)
      })
      childEl.appendChild(delEl)
    }
    parentEl.appendChild(childEl)
    childEl.addEventListener('contextmenu', event => {
      event.preventDefault()
      event.stopImmediatePropagation();
      node.taskComplete = !node.taskComplete;
      save(rawList);
    })

    if (nodeHasChildren(node)) {
      let subEl = document.createElement('ul')
      subEl.id = 'listchild-sub-' + node.name
      subEl.className = `tree-list`
      childEl.appendChild(subEl)
    }

  }
}

function extractFaviconUrl(urlStr) {
  let url = new URL(urlStr)
  // @todo: only way to do favicons properly is to fetch their index.html and extract the true favicon name from the meta tags
  // for now we will just make some guesses
  let faviconPath = 'favicon.ico'
  let faviconOrigin = url.origin
  switch (url.hostname) {
    case 'zoom.us':
      faviconPath = 'zoom.ico'
    break
    case 'calendar.google.com':
      faviconPath = 'googlecalendar/images/favicon_v2014_3.ico'
    break
    case 'www.figma.com':
      faviconOrigin = 'https://static.figma.com'
      faviconPath = 'app/icon/1/icon-128.png'
    break
    case 'www.atlassian.com':
      faviconOrigin = 'https://wac-cdn.atlassian.com'
      faviconPath = 'assets/img/favicons/atlassian/favicon.png'
    break
    case 'localhost':
      faviconOrigin = ''
      faviconPath = 'misc/favicon.ico'
    break
  }
  return `${faviconOrigin}/${faviconPath}`
}

function htmlToElement(html) {
  var template = document.createElement('template');
  html = html.trim(); // Never return a text node of whitespace as the result
  template.innerHTML = html;
  return template.content.removeChild(template.content.firstChild);
}


function clearForm() {
  nameField.value = ''
  urlField.value = ''
  parentField.value = ''
}

// ensures the name isn't already taken
function validName(str) {
  return !names.includes(str)
}

// ensures the name is already taken
function validParent(str) {
  return names.includes(str)
}

function validURL(str) {
  return /^https?:\/\//.test(str);
}

function nodeHasChildren(node) {
  return Boolean(node.children && node.children.length > 0)
}

function renderWelcome(shouldRender) {
  removeWelcome()
  if (shouldRender){
    let x = document.createElement("div")
    x.className = "welcome-message"
    x.innerText = "This is Zero State. To add your first node, click the [+] button in the top right corner"
    overlayContainer.appendChild(x)
  }
}

function removeWelcome() {
  let children = document.getElementsByClassName("welcome-message")
  if (children.length > 0) {
    overlayContainer.removeChild(children[0])
  }
}