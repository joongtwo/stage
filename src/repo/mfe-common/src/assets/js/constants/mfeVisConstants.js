// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/constants/mfeVisConstants
 */



 export const constants = {

     //GRAPHICS VISIBILITY STATES
     VISIBILITY_STATUS:{
         ALL: 'ALL',
         NONE: 'NONE',
         SOME: 'SOME',
         LOADING: 'LOADING',
         NO_JT: 'NO_JT',
         VISIBLE: 'VISIBLE',
         HIDDEN: 'HIDDEN'
     },

     //GRAPHICS VISIBILITY PROPERTY NAME
     GRAPHICS_VISIBILITY_PROP_NAME: 'graphicsVisibility',

     BOM_LOAD_TYPE: 'BOMLine',
     BOP_LOAD_TYPE: 'BOPLine'

 };

 export default { constants };

