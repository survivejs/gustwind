/// <reference lib="dom" />
import { produce } from "https://cdn.skypack.dev/immer@9.0.6?min";
import { draggable } from "../utils/draggable.ts";
import breeze from "../breeze/index.ts";
import * as breezeExtensions from "../breeze/extensions.ts";
// import { getPagePath } from "../utils/getPagePath.ts";
import type { Components, DataContext, Layout, Route } from "../types.ts";
import type { Component as BreezeComponent } from "../breeze/types.ts";

// TODO: Figure out how to deal with the now missing layout body
const documentTreeElementId = "document-tree-element";
const controlsElementId = "controls-element";

type StateName = "editor" | "selected";

// TODO: Consume these types from sidewind somehow (pragma?)
declare global {
  function getState<T>(element: HTMLElement): T;
  function setState<T>(
    state: T,
    { element, parent }: { element: HTMLElement; parent: StateName },
  ): void;
  function evaluateAllDirectives(): void;
}

type EditorState = {
  layout: Layout;
  meta: Route["meta"];
  selectionId?: string;
};
type PageState = {
  editor: EditorState;
};

async function createEditor() {
  console.log("create editor");

  const [components, context, layout, route]: [
    Components,
    DataContext,
    Layout,
    Route,
  ] = await Promise.all([
    fetch("/components.json").then((res) => res.json()),
    fetch("./context.json").then((res) => res.json()),
    fetch("./layout.json").then((res) => res.json()),
    fetch("./route.json").then((res) => res.json()),
  ]);

  const editorContainer = createEditorContainer(layout, route);

  const pageEditor = await createPageEditor(
    components,
    context,
  );
  editorContainer.append(pageEditor);

  const componentEditor = await createComponentEditor(components, context);
  editorContainer.append(componentEditor);

  // TODO: Re-enable the side effect to update FS
  // Likely this should send patches, not whole structures
  //const updateElement = document.createElement("div");
  //updateElement.setAttribute("x", "updateFileSystem(state)");
  //editorsElement.appendChild(updateElement);

  document.body.appendChild(editorContainer);

  evaluateAllDirectives();

  // https://stackoverflow.com/questions/9012537/how-to-get-the-element-clicked-for-the-whole-document
  // Reference: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
  globalThis.onclick = ({ target }) => {
    // TODO: How to know this is HTMLElement during runtime?
    const t = target as HTMLElement;
    const closestElement = t.hasAttribute("data-id")
      ? t
      : getParents(t, "data-id")[0];

    // Likely the user clicked on something within an editor panel for example
    if (!closestElement) {
      return;
    }

    const selectionId = closestElement.getAttribute("data-id");
    const element = editorContainer.children[0];
    const { editor: { layout } } = getState<PageState>(
      // @ts-ignore: TODO: Allow passing editorContainer here (sidewind needs a fix)
      element,
    );

    setState({ selectionId }, {
      // @ts-ignore: TODO: Allow passing editorContainer here (sidewind needs a fix)
      element: editorContainer.children[0],
      parent: "editor",
    });
    closestElement && elementSelected(editorContainer, closestElement, layout);
  };
}

// Adapted from Sidewind
function getParents(
  element: Element,
  attribute: string,
) {
  const ret = [];
  let parent = element.parentElement;

  while (true) {
    if (!parent) {
      break;
    }

    if (parent.hasAttribute(attribute)) {
      ret.push(parent);
    }

    parent = parent.parentElement;
  }

  return ret;
}

let editedElement: Element;

function elementSelected(
  editorContainer: HTMLElement,
  target: HTMLElement,
  layout: Layout,
) {
  let previousContent: string;
  const selectionId = target.dataset.id;

  if (!selectionId) {
    console.log("target doesn't have a selection id");

    return;
  }

  const focusOutListener = (e: Event) => {
    const inputElement = (e.target as HTMLElement);

    if (!inputElement) {
      console.warn("inputListener - No element found");

      return;
    }

    e.preventDefault();

    target.removeAttribute("contenteditable");
    target.removeEventListener("focusout", focusOutListener);

    const newContent = inputElement.textContent;

    if (previousContent === newContent) {
      console.log("content didn't change");

      return;
    }

    if (typeof newContent !== "string") {
      return;
    }

    console.log("content changed", newContent);

    const nextLayout = produce(layout, (draftLayout: Layout) => {
      traverseComponents(draftLayout, (p) => {
        if (p?.attributes?.["data-id"] === selectionId) {
          p.children = newContent;
        }
      });
    });

    const element = editorContainer.children[0];

    setState({ layout: nextLayout }, {
      // @ts-ignore: TODO: Allow passing editorContainer here (sidewind needs a fix)
      element,
      parent: "editor",
    });
  };

  if (editedElement) {
    editedElement.classList.remove("border");
    editedElement.classList.remove("border-red-800");
  }

  editedElement = target;

  target.classList.add("border");
  target.classList.add("border-red-800");

  // If element has children, enabling contenteditable on it will mess
  // up logic due to DOM change.
  if (target.children.length === 0 && target.textContent) {
    previousContent = target.textContent;

    target.setAttribute("contenteditable", "true");
    target.addEventListener("focusout", focusOutListener);

    // @ts-ignore TODO: Maybe target has to become HTMLElement?
    target.focus();
  }
}

const editorsId = "editors";

function createEditorContainer(layout: Layout, route: Route) {
  let editorsElement = document.getElementById(editorsId);
  const initialState: EditorState = {
    layout,
    meta: route.meta,
    selectionId: undefined,
  };

  editorsElement?.remove();

  editorsElement = document.createElement("div");
  editorsElement.id = editorsId;
  editorsElement.style.visibility = "visible";
  editorsElement.setAttribute(
    "x-state",
    JSON.stringify(initialState),
  );
  editorsElement.setAttribute("x-label", "editor");

  return editorsElement;
}

function toggleEditorVisibility() {
  const editorsElement = document.getElementById(editorsId);

  if (!editorsElement) {
    return;
  }

  editorsElement.style.visibility =
    editorsElement.style.visibility === "visible" ? "hidden" : "visible";
}

// TODO: Restore
/*
function updateFileSystem(state: Layout) {
  const nextBody = produce(state.body, (draftBody: Layout) => {
    traverseComponents(draftBody, (p) => {
      // TODO: Generalize to erase anything that begins with a single _
      delete p._id;

      if (p.class === "") {
        delete p.class;
      }
    });
  });

  const payload = {
    path: getPagePath(),
    data: { ...state, body: nextBody },
  };

  // TODO: Don't send if payload didn't change
  // @ts-ignore Figure out where to declare the global
  window.developmentSocket.send(JSON.stringify({ type: "update", payload }));
}
*/

async function createPageEditor(
  components: Components,
  context: DataContext,
) {
  console.log("creating page editor");

  const treeElement = document.createElement("div");
  treeElement.id = documentTreeElementId;
  treeElement.innerHTML = await breeze({
    component: components.PageEditor,
    components,
    // @ts-ignore: TODO: Fix type
    context,
    extensions: [
      breezeExtensions.classShortcut,
      breezeExtensions.foreach,
      breezeExtensions.visibleIf,
    ],
  });

  const aside = treeElement.children[0] as HTMLElement;
  const handle = aside.children[0] as HTMLElement;
  draggable({ element: aside, handle });

  return treeElement;
}

async function createComponentEditor(
  components: Components,
  context: DataContext,
) {
  const controlsElement = document.createElement("div");
  controlsElement.id = controlsElementId;
  controlsElement.innerHTML = await breeze({
    component: components.ComponentEditor,
    components,
    // @ts-ignore: TODO: Fix type
    context,
    extensions: [
      breezeExtensions.classShortcut,
      breezeExtensions.foreach,
      breezeExtensions.visibleIf,
    ],
  });

  const aside = controlsElement.children[0] as HTMLElement;
  const handle = aside.children[0] as HTMLElement;
  draggable({ element: aside, handle, xPosition: "right" });

  return controlsElement;

  // TODO: Gradient syntax
  // bg-gradient-to-br
  // from-purple-200
  // to-emerald-100

  // TODO: Padding
  // py-8
  // px-4
  // pr-4
  // sm:py-8

  // TODO: Margin
  // sm:mx-auto

  // TODO: Max width
  // max-w-3xl

  // TODO: Width
  // w-full

  // TODO: Flex
  // flex
  // flex-col
  // gap-8

  // TODO: Text size
  // text-4xl
  // text-xl
  // md:text-4xl
  // md:text-8xl

  // TODO: Wrapping
  // whitespace-nowrap

  // TODO: Font weight
  // font-extralight

  // TODO: Prose
  // prose
  // lg:prose-xl

  // TODO: Orientation
  // fixed

  // TODO: Position
  // top-16

  // TODO: Visibility
  // hidden
  // lg-inline
}

function metaChanged(
  element: HTMLElement,
  value: string,
) {
  const { editor: { meta } } = getState<PageState>(element);
  const field = element.dataset.field as string;

  if (!field) {
    console.error(`${field} was not found in ${element.dataset}`);

    return;
  }

  if (field === "title") {
    const titleElement = document.querySelector("title");

    if (titleElement) {
      titleElement.innerHTML = value || "";
    } else {
      console.warn("The page doesn't have a <title>!");
    }
  } else {
    // TODO: Generalize this to work with other bindings as well. If any of
    // of the meta fields change, likely this should trigger renderComponent
    // using updated context and the head definition
    const metaElement = document.head.querySelector(
      "meta[name='" + field + "']",
    );

    if (metaElement) {
      metaElement.setAttribute("content", value);
    } else {
      console.warn(`The page doesn't have a ${field} meta element!`);
    }
  }

  setState({ meta: { ...meta, [field]: value } }, {
    element,
    parent: "editor",
  });
}

function contentChanged(
  element: HTMLElement,
  value: string,
) {
  const { editor: { layout, selectionId } } = getState<PageState>(
    element,
  );
  const nextLayout = produceNextLayout(layout, selectionId, (p, elements) => {
    elements.forEach((e) => {
      e.innerHTML = value;
    });

    p.children = value;
  });

  setState({ layout: nextLayout }, { element, parent: "editor" });
}

function classChanged(
  element: HTMLElement,
  value: string,
) {
  const { editor: { layout, selectionId } } = getState<PageState>(
    element,
  );

  const nextLayout = produceNextLayout(layout, selectionId, (p, elements) => {
    if (Array.isArray(p)) {
      return;
    }

    elements.forEach((e) => e.setAttribute("class", value));

    // @ts-ignore This is fine
    p.class = value;
  });

  setState({ layout: nextLayout }, {
    element,
    parent: "editor",
  });
}

function elementChanged(
  element: HTMLElement,
  value: string,
) {
  const { editor: { layout, selectionId } } = getState<PageState>(
    element,
  );
  const nextLayout = produceNextLayout(layout, selectionId, (p, elements) => {
    if (Array.isArray(p)) {
      return;
    }

    elements.forEach((e) => e.replaceWith(changeTag(e, value)));

    p.element = value;
  });

  setState({ layout: nextLayout }, { element, parent: "editor" });
}

// https://stackoverflow.com/questions/2206892/jquery-convert-dom-element-to-different-type/59147202#59147202
function changeTag(element: HTMLElement, tag: string) {
  // prepare the elements
  const newElem = document.createElement(tag);
  const clone = element.cloneNode(true);

  // move the children from the clone to the new element
  while (clone.firstChild) {
    newElem.appendChild(clone.firstChild);
  }

  // copy the attributes
  // @ts-ignore Fine like this
  for (const attr of clone.attributes) {
    newElem.setAttribute(attr.name, attr.value);
  }
  return newElem;
}

function produceNextLayout(
  layout: Layout,
  selectionId: EditorState["selectionId"],
  matched: (p: BreezeComponent, elements: HTMLElement[]) => void,
) {
  return produce(layout, (draftLayout: Layout) => {
    traverseComponents(draftLayout, (p) => {
      if (p?.attributes?.["data-id"] === selectionId) {
        matched(
          p,
          Array.from(document.querySelectorAll(`*[data-id="${selectionId}"]`)),
        );
      }
    });
  });
}

function getSelectedComponent(editor: EditorState) {
  const { layout, selectionId } = editor;

  if (!selectionId) {
    return {};
  }

  let ret;

  traverseComponents(layout, (p) => {
    if (p?.attributes?.["data-id"] === selectionId) {
      ret = p;
    }
  });

  return ret;
}

function traverseComponents(
  components: Layout,
  operation: (c: BreezeComponent, index: number) => void,
) {
  let i = 0;

  function recurse(
    components: BreezeComponent | BreezeComponent[],
    operation: (c: BreezeComponent, index: number) => void,
  ) {
    if (Array.isArray(components)) {
      components.forEach((p) => recurse(p, operation));
    } else {
      operation(components, i);
      i++;

      if (Array.isArray(components.children)) {
        recurse(components.children, operation);
      }

      if (components.props) {
        // @ts-ignore TODO: Figure out a better type for this
        recurse(Object.values(components.props), operation);
      }
    }
  }

  recurse(components, operation);
}

declare global {
  interface Window {
    createEditor: typeof createEditor;
    classChanged: typeof classChanged;
    contentChanged: typeof contentChanged;
    getSelectedComponent: typeof getSelectedComponent;
    metaChanged: typeof metaChanged;
    elementChanged: typeof elementChanged;
  }
}

if (!("Deno" in globalThis)) {
  console.log("Hello from the page editor");

  window.createEditor = createEditor;
  window.classChanged = classChanged;
  window.contentChanged = contentChanged;
  window.getSelectedComponent = getSelectedComponent;
  window.metaChanged = metaChanged;
  window.elementChanged = elementChanged;
}

export { createEditor, toggleEditorVisibility };
