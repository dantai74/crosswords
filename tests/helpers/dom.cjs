// Small DOM fixture for shell interactions. CSS layout still requires a browser.
class Element {
  constructor(tag, document) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = document;
    this.childNodes = [];
    this.attributes = new Map();
    this.listeners = {};
    this.dataset = {};
    this.value = "";
    this.tabIndex = -1;
    this.clientHeight = 0;
    this.clientWidth = 0;
    this.clientTop = 0;
    this.clientLeft = 0;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.classList = {
      contains: (name) => this.className.split(/\s+/).includes(name),
      add: (name) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), name])].join(" "); },
      remove: (name) => { this.className = this.className.split(/\s+/).filter((value) => value !== name).join(" "); },
    };
  }
  get children() { return this.childNodes.filter((node) => node instanceof Element); }
  get className() { return this.getAttribute("class") || ""; }
  set className(value) { this.setAttribute("class", value); }
  get id() { return this.getAttribute("id") || ""; }
  set id(value) { this.setAttribute("id", value); }
  get textContent() { return this.childNodes.map((node) => typeof node === "string" ? node : node.textContent).join(""); }
  set textContent(value) { this.childNodes = [String(value)]; }
  set innerHTML(html) {
    this.childNodes = [];
    const stack = [this];
    for (const token of html.match(/<[^>]+>|[^<]+/g) || []) {
      if (token.startsWith("</")) { stack.pop(); continue; }
      if (token.startsWith("<")) {
        const [, tag, attributes] = token.match(/^<([\w-]+)([^>]*)>/);
        const node = this.ownerDocument.createElement(tag);
        for (const [, name, value] of attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
          node.setAttribute(name, value || "");
        }
        stack.at(-1).appendChild(node);
        stack.push(node);
      } else {
        stack.at(-1).childNodes.push(token.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
      }
    }
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith("data-")) {
      this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = String(value);
    }
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  appendChild(node) { node.parentElement = this; this.childNodes.push(node); return node; }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  matches(selector) {
    const tag = selector.match(/^[\w-]+/);
    if (tag && this.tagName !== tag[0].toUpperCase()) return false;
    const id = selector.match(/#([\w-]+)/);
    if (id && this.id !== id[1]) return false;
    for (const [, name] of selector.matchAll(/\.([\w-]+)/g)) {
      if (!this.classList.contains(name)) return false;
    }
    for (const [, name, value] of selector.matchAll(/\[([\w-]+)="([^"]*)"\]/g)) {
      if (this.getAttribute(name) !== value) return false;
    }
    return true;
  }
  querySelectorAll(selector) {
    const result = [];
    const parts = selector.split(/\s+/);
    const visit = (node) => {
      for (const child of node.children) {
        if (child.matches(parts.at(-1))) {
          let ancestor = child.parentElement;
          let i = parts.length - 2;
          while (ancestor && i >= 0) {
            if (ancestor.matches(parts[i])) i--;
            ancestor = ancestor.parentElement;
          }
          if (i < 0) result.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (node.matches(selector)) return node;
    }
    return null;
  }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  dispatchEvent(event) {
    event.target ||= this;
    for (const handler of this.listeners[event.type] || []) handler.call(this, event);
    if (event.bubbles && this.parentElement) this.parentElement.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  focus(options) {
    this.focusOptions = options;
    if (this.ownerDocument.activeElement === this) return;
    this.ownerDocument.activeElement = this;
    this.dispatchEvent({ type: "focus" });
  }
  select() { this.selected = true; }
  scrollIntoView(options) { this.scrollIntoViewOptions = options; }
  getBoundingClientRect() { return this.rect || { top: 0, bottom: 0, height: 0 }; }
}

function createDocument() {
  const document = {
    createElement(tag) { return new Element(tag, document); },
    createTextNode(text) { return { textContent: String(text) }; },
  };
  return document;
}

function event(type, properties = {}) {
  return {
    type, bubbles: true, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    ...properties,
  };
}

module.exports = { createDocument, event };
