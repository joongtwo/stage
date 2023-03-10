// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *
 * @module js/ssp0ServicePlannerConstants
 */
'use strict';

export const constants = {
    //Types
    TYPE_SERVICE_CONTAINER: 'SSP0SvcContainer',
    TYPE_SERVICE_REQUIREMENT: 'SSP0ServiceReq',
    TYPE_WORK_CARD: 'SSP0WorkCard',
    TYPE_AWB_PART_ELEMENT: 'Awb0PartElement',
    TYPE_AWB_ELEMENT: 'Awb0Element',
    TYPE_OCCURRENCE: 'MEAssign',
    TYPE_PART: 'Part',
    TYPE_ITEM: 'Item',
    TYPE_PART_REVISION: 'PartRevision',

    //Process Types
    TYPE_PART_PROCESS: 'Mfg0BvrPart',
    TYPE_SERVICE_PLAN_PROCESS: 'SSP0BvrServicePlan',
    TYPE_SERVICE_PARTITION_PROCESS: 'SSP0BvrServicePartition',
    TYPE_SERVICE_REQUIREMENT_PROCESS: 'SSP0BvrServiceRequirement',
    TYPE_WORK_CARD_PROCESS: 'SSP0BvrWorkCard',
    TYPE_SERVICE_CONTAINER_PROCESS: 'SSP0BvrServiceContainer',

    //Viewer Instances
    PARTS_VIEWER_INSTANCE_ID: 'PartsViewer',
    SBOM_VIEWER_INSTANCE_ID: 'SBOMViewer',

    //Messages
    MSG_WC_CREATED: 'newWorkCardCreated',
    MSG_SC_CREATED: 'serviceContainerCreated',
    MSG_SR_CREATED: 'serviceReqCreated',

    //EVENTS
    GRAPHICS_VISIBILITY_TOGGLE_EVENT: 'spVisGraphicsVisibilityChanged',
    PARTS_GRAPHICS_VISIBILITY_TOGGLE_EVENT: 'partsVisGraphicsVisibilityChanged',
    SP_PARTS_GRAPHICS_VISIBILITY_TOGGLE_EVENT: 'spPartsVisGraphicsVisibilityChanged',

    //HTML CLASS
    TABLE_CELL_INDICATOR_CLASS: 'aw-ep-tableCellindicator',
    INDICATOR_HIDDEN_CLASS: 'aw-ep-indicatorHidden'

};

export default { constants };

