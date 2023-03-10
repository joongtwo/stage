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
 * @module js/wiConstants
 */


export const constants = {
    //WI
    JPEG_OBJECT_TYPE: 'JPEG',
    BITMAP_OBJECT_TYPE: 'Bitmap',
    SNAPSHOT_OBJECT_TYPE: 'SnapShotViewData',
    IMAGE_OBJECT_TYPE: 'Image',
    GIF_OBJECT_TYPE: 'GIF',
    AWP_IMAGE_VIEWER: 'Awp0ImageViewer',

    //WI EVENT CONSTANTS
    SWITCH_VIEWER_EVENT: 'switchViewerEvent',
    VIEWER_PANEL_EVENT: 'workinstrUpdateViewerPanel',
    SET_DATASETS_EVENT: 'setDataSetsEvent',
    VIEWER_SWITCHED_EVENT: 'viewerSwitchedEvent',
    CAPTURE_2D_IMAGE_EVENT: 'capture2DImageEvent',
    SYNC_TREE_WITH_PDF_VIEWER: 'syncTreeWithPdfViewer',
    WI_CREATE_DATASET_EVENT: 'wi.createDataSet',

    //WI Create dataset
    Epw0WIDataset: 'Epw0WIDataset',
    Epw0WIRelation: 'Epw0WIRelation',
    Core_2010_04_DataManagement: 'Core-2010-04-DataManagement',
    CREATE_DATASET_SOA: 'createDatasets'
};

export default { constants };
