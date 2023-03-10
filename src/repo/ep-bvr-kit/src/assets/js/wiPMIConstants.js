// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/wiPMIConstants
 */


 const constants = {
     //pseudo properties
     NOT_FOUND: -1,
     LOAD_ASSEMBLY_PMIS_TYPE: 'PMI_Info',
     INSPECTIONS: 'AssignedPMIs',
    UNCONFIGURED_PMI:'UnconfiguredAssignedPMI',
     PMI_ASSEMBLY_PMIS_PSEUDO_PROP: 'assemblyPMIs',
     PMI_CHARACTERISTICS_PSEUDO_PROP: 'characteristics',
     PMI_CONNECTED_PARTS_PSEUDO_PROP: 'connectedParts',
     PMI_REFERENCED_DATUMS_PSEUDO_PROP: 'referencedDatums',
     PMI_ASSIGNMENT_INFO_LOAD_TYPE: 'PMI_AssignmentInfo',
     PMI_ASSIGNMENT_INFO_PSEUDO_PROP: 'PMIAssignmentStatus',
     PMI_ASSIGNED_IN_CURRENT_SCOPE_PSEUDO_PROP: 'AssignedToInCurrentScope',
     PMI_ASSIGNED_IN_OTHER_SCOPE_PSEUDO_PROP: 'AssignedToInOtherScope',
     ASSIGNMENT_INDICATION_STATUS_PROP: 'assignmentStatus',
     ASSIGNMENT_INDICATION_STATUS_PROP_VALUES : {
         NOT_ASSIGNED: 'NotAssigned',
         ASSIGNED_IN_CURRENT_SCOPE: 'AssignedInCurrentScope',
         ASSIGNED_IN_OTHER_SCOPE: 'AssignedInOtherScope',
         MULTIPLE_ASSIGNED_IN_CURRENT_SCOPE: 'MultipleAssignedInCurrentScope',
         MULTIPLE_ASSIGNED_IN_OTHER_SCOPE: 'MultipleAssignedInOtherScope'
     },
     PMI_CONTEXT_PSEUDO_PROP: 'mci0context',
     PMI_DEFINED_IN_COLUMN_TYPE_NAME: 'PMIsContext',
     PMI_DEFINED_IN_COLUMN_PROPERTY_NAME: 'DefinedIn',
     PMI_WHERE_DEFINED_EVENT_NAME: 'mci0WhereDefinedEvent',
     PMI_TARGET_ASSEMBLY: 'connectedPartTargetAssembly',
     PMI_TARGET_PROCESS: 'targetAssemblyTargetProcess',
     PMI_TARGET_ASSEMBLY_PROP: 'targetAssembly',
     PMI_TARGET_PROCESS_PROP: 'targetProcess',
    PMI_IS_UNCONFIGURED_PSEUDO_PROP: 'is_unconfigured',

     //real props
     MCI_PMI_DESCRIPTION: 'mci0PmiDescription',
     MCI_PMI_META_DATA: 'mci0pmiMetaData',
     MCI_PMI_MARKED_AS_DELETED: 'mci0MarkedAsDeleted',
     MCI_CHARACTERISTIC_OF_INSPECTION:'mci0characteristic',
     MCI_DATUM_LABEL: 'mci0DatumLabel',
     MCI_PMI_ASSOCIATION_TYPE: 'mci0AssociationType',
     MCI_PMI_ASSOCIATION_ID: 'mci0AssociationId',

     //types
     MCI_PMI_CHARACTERISTIC: 'Mci0PMICharacteristic',
     MCI_INSPECTION_REVISION: 'Mci0InspectionRevision'
 };

 export default constants;

