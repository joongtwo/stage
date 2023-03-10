// @<COPYRIGHT>@
// ==================================================
// Copyright 2019.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/wiCtxConstants
 */


export const constants = {

    //WI page ctx
    WI_PAGE_CONTEXT: 'wiPageContext',
    WI_PAGE_CONTEXT_WI_SELECTION_MODE: 'wiPageContext.wiSelectionMode',
    WI_PAGE_CONTEXT_IS_GRAPHICS_INSTALLED: 'wiPageContext.isGraphicsInstalled',

    //wi editor ctx
    WI_EDITOR: 'wiEditor',
    WI_EDITOR_SELECTED_OBJECT_DATA: 'wiEditor.selectedObjectData',
    WI_EDITOR_DIRTY_EDITOR: 'wiEditor.dirtyEditor',
    WI_EDITOR_OBJECT_ID_TO_DATASET_MAP: 'wiEditor.objectIdToDatasetsMap',
    WI_EDITOR_EDITOR_ID_TO_OBJ_UID: 'wiEditor.EditorIdToObjUid',
    WI_IS_SAVE_INSTRUCTIONS_ENABLED :'wiEditor.isSaveWorkInstrictionsEnabled',

    // wi effectivity
    WI_EFFECTIVITY_IS_DIRTY: 'wiEffectivity.dirty'
};

export default { constants };
