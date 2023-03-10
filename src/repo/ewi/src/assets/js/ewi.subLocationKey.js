// @<COPYRIGHT>@
// ==================================================
// Copyright 2017.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* global
 define
 */

/**
 * This is the EWI sublocation key contribution.
 *
 * @module js/ewi.subLocationKey
 */
'use strict';

var contribution = {
    clientScopeURI: 'Ewi0EwiSubLocation',
    id: 'tc_xrt_EWI',
    label: {
        source: '/i18n/EWIMessages',
        key: 'EWILabel'
    },
    nameToken: 'com.siemens.splm.client.ewi:ewiSubLocation',
    pageNameToken: 'ewi',
    priority: 0,
    visibleWhen: function( modelObject ) {
        // TODO need to make this check configurable to include more types in future
        return modelObject.modelType.typeHierarchyArray.indexOf( 'CCObject' ) !== -1  &&
            modelObject.modelType.typeHierarchyArray.indexOf( 'Eda0EDMDCollaboration' ) === -1//
            ||
            modelObject.modelType.typeHierarchyArray.indexOf( 'MEProcessRevision' ) !== -1 //
            ||
            modelObject.modelType.typeHierarchyArray.indexOf( 'MEOPRevision' ) !== -1 &&
            modelObject.modelType.typeHierarchyArray.indexOf( 'MENCMachining Revision' ) === -1 &&
            modelObject.modelType.typeHierarchyArray.indexOf( 'Mfg0CMMInspMEOPRevision' ) === -1 &&
            modelObject.modelType.typeHierarchyArray.indexOf( 'Mea0MEFixPlaneOPRevision' ) === -1;
    }
};

/**
 *
 * @param {String} key - The key
 * @param {Promise} deferred - Promise
 */
export default function( key, deferred ) {
    if( key === 'showObjectSubLocation' ) {
        deferred.resolve( contribution );
    } else {
        deferred.resolve();
    }
}
