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
 * @module js/epSaveConstants
 */

export const constants = {

    // SAVE INPUT
    OBJECTS_TO_CREATE: 'ObjectsToCreate',
    OBJECTS_TO_DELETE: 'ObjectsToDelete',
    OBJECTS_TO_MODIFY: 'ObjectsToModify',
    OBJECTS_TO_CLONE: 'ObjectsToClone',
    OBJECT_TO_INSTANTIATE: 'ObjectToInstantiate',
    CREATE_WORKFLOW: 'CreateWorkflow',
    ACCOUNTABILITY_CHECK: 'AccountabilityCheck',
    SESSION: 'session',
    RELOAD: 'Reload',
    CREATE_REPORT: 'CreateReport',
    CREATE_ALTERNATIVE: 'CreateAlternative',
    TIME_UNITS: 'timeUnits',
    OBJECTS_TO_REVISE: 'ObjectsToRevise',
    REMOVED_FROM_RELATION: 'removedFromRelation',
    ADDED_TO_RELATION: 'addedToRelation',
    MODIFY_RELATIONS: 'modifyRelations',

    CREATE_DATASET_RELATION: 'create',
    DATASET_ID: 'datasetID',
    PMI_IS_UNCONFIGURED_PSEUDO_PROP: 'is_unconfigured',

    // EVENTS
    EVENT_PRIMITIVE_PROPERTIES: 'MODIFY_PRIMITIVE_PROPERTIES',
    EVENT_MODIFY_RELATIONS: 'MODIFY_RELATIONS',
    EVENT_MODIFY_PRIMITIVE_PROPERTIES: 'modifyPrimitiveProperties',
    REPORT_GENERATED: 'reportGenerated',
    DELETE: 'delete',
    CREATE_EVENT: 'create',
    GET_WI_LIST_EVENT:'WIDataList',
    GET_WI_DATA_LIST_TYPE:'GetWIDataList',
    EVENT_ASSOCIATED_PROCESS:'associatedProcess',

    // Accountability EVENT
    ACCOUNTABILITYCHECK_EVENT: 'accountabilityCheck',
    MISSING_IN_SOURCE: '-1',
    SINGLE_CONSUMPTION_IN_SCOPE: '101',
    SINGLE_CONSUMPTION_OUT_OF_SCOPE: '102',
    MULTIPLE_CONSUMPTION_IN_SCOPE: '103',
    MULTIPLE_CONSUMPTION_OUT_OF_SCOPE: '104',

    // Background Parts
    BACKGROUND_PART_ASSIGNMENT_MODE: 'BackgroundPart',
    BACKGROUND_PART_EVENT: 'backgroundPart',
    BACKGROUND_PART_ADDED_EVENT: 'Added',
    BACKGROUND_PART_REMOVED_EVENT: 'Removed',

    // RuleStream Generate Structure
    RULE_STREAM_GENERATION: 'InvokeRulestreamStrcutreGeneration'
};

export default { constants };
