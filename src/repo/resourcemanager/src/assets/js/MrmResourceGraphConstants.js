// Copyright 2019 Siemens Product Lifecycle Management Software Inc.

/* global
 define
 */
/**
 * This module defines MRM Resource graph constants
 *
 * @module js/MrmResourceGraphConstants
 */

'use strict';

var exports = {};

/**
 * The layout options supported by MRM Resource graph component, object format as: {key: GCLayoutDirection, value: GCCommandId}
 */
export let MRMResourceLayoutOptions = {
    // GCLayoutDirection: GCCommandId
    TopToBottom: 'GcTopToBottomLayout',
    BottomToTop: 'GcBottomToTopLayout',
    RightToLeft: 'GcRightToLeftLayout',
    LeftToRight: 'GcLeftToRightLayout',
    Incremental: 'GcIncrementalLayout',
    Organic: 'GcOrganicLayout'
};

export let MRMResourceGraphConstants = {
    MRMLicenseKey: 'resource_manager_mrl',
    ToolAssemblyClassID: 'TOOL_ASSY',
    UNCT_CLASS_ID: 'CLASS_ID',
    ToolAssemblyTurningClassID: 'TAG001_TURN',
    OccurenceManagementContextKey: 'occmgmtContext',
    SearchContextKey: 'search',
    OccurrenceManagementSubLocationId: 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation',
    ManageResourcesLocationId:'com.siemens.splm.client.mrm.manageResourcesLocation',
    ToolCompClassID: 'TOOL_COMP',
    UNCT_CLASS_UNIT_SYSTEM: -630,
    CLASS_ATTR_VENDOR_REFERENCE_OBJECT_ID: -40930,
    SEARCH_IN_BOTH_UNITSYSTEM: 8,
    SYS_OF_MEASUREMENT_METRIC: '0'
};

export default exports = {
    MRMResourceLayoutOptions,
    MRMResourceGraphConstants
};
