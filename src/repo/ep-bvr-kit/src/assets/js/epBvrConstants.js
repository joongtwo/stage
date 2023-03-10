// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/epBvrConstants
 */


export const constants = {
    // MFG
    MFG_PROCESS_RESOURCES: 'Mfg0processResources',
    MFG_BVR_PROCESS_RESOURCE: 'Mfg0BvrProcessResource',
    MFG_BVR_PART: 'Mfg0BvrPart',
    MFG_BVR_EQUIPMENT: 'Mfg0BvrEquipment',
    MFG_PREDECESSORS: 'Mfg0predecessors',
    MFG_PROCESS_LINE: 'Mfg0BvrProcessLine',
    MFG_PROCESS_AREA: 'Mfg0BvrProcessArea',
    MFG_PROCESS_STATION: 'Mfg0BvrProcessStation',
    MFG_PROCESS_PARTITION: 'Mfg0BvrProcessPartition',
    MFG_PLANT_BOP: 'Mfg0BvrPlantBOP',
    MFG_ALLOCATED_OPS: 'Mfg0allocated_ops',
    MFG_BVR_OPERATION: 'Mfg0BvrOperation',
    MFG_PRODUCT_BOP: 'Mfg0BvrProductBOP',
    MFG_CONSUMED_PARTS: 'Mfg0consumed_material',
    MFG_BVR_WORKAREA: 'Mfg0BvrWorkarea',
    MFG_SUB_ELEMENTS: 'Mfg0sub_elements',
    MFG_BVR_PROCESS: 'Mfg0BvrProcess',
    MFG_ALL_MATERIAL: 'Mfg0all_material',
    MFG_BVR_BOP_WORKAREA: 'Mfg0BvrBOPWorkarea',
    MFG_PRODUCT_VARIANTS: 'Mfg0productVariants',
    MFG_PRODUCTION_RATE: 'Mfg0productionRate',

    //ME
    ME_WORKAREA: 'MEWorkArea',
    ME_TOOL: 'METool',
    ME_COLLABORATION_CONTEXT: 'MECollaborationContext',
    ME_LINKED_BOE: 'Mfg0linkedBOEObject',
    ME_LINKED_BOP: 'Mfg0linkedPlantBOPObject',

    // BL
    BL_PARENT: 'bl_parent',
    BL_REV_OBJECT_NAME: 'bl_rev_object_name',
    BL_REV_OBJECT_TYPE: 'bl_rev_object_type',
    BL_REV_CHECKED_OUT: 'bl_rev_checked_out',
    BL_REV_CHECKED_OUT_USER: 'bl_rev_checked_out_user',
    BL_ITEM_FND_MFKINFO: 'bl_item_fnd0mfkinfo',
    BL_FORMULA: 'bl_formula',
    BL_VARIANT_CONDITION: 'bl_variant_condition',
    BL_REVISION: 'bl_revision',
    BL_OCC_EFFECTIVITY_PROP_NAME: 'bl_occ_effectivity',
    BL_ITEM_OBJECT_TYPE_NAME: 'bl_item_object_type',
    BL_SEQUENCE_NO: 'bl_sequence_no',
    BL_ITEM: 'bl_item',
    BL_OCC_TYPE: 'bl_occ_type',
    BL_ITEM_ITEM_ID: 'bl_item_item_id',
    BL_PACK_MASTER: 'bl_pack_master',

    CAPACITY: 'capacity',

    // ELB
    ELB_CYCLE_TIME: 'elb0cycleTime',
    ELB_WORK_CONTENT_BY_PV: 'elb0workContentByPV',
    ELB_UNASSIGNED_TIME_BY_PV: 'elb0unassignedTimeByPV',
    ELB_SHARED_WITH_STATIONS: 'elb0sharedWithStations',
    ELB_ALLOCATED_OPS_BY_PV: 'elb0allocatedOpsByPV',
    ELB_ALLOCATED_TIME_BY_PV: 'elb0allocatedTimeByPV',
    ELB_START_TIME: 'elb0startTime',
    ELB_TAKT_TIME: 'elb0taktTime',
    ELB_TAKT_TIME_CONVERTED: 'elb0taktTimeConverted',

    // AWB
    AWB_BOM_LINE_ITEM_ID: 'awb0BomLineItemId',
    AWB_ELEMENT: 'Awb0Element',

    // MBC
    MBC_IS_READ_ONLY: 'mbc0IsReadOnly',
    MBC_MASTER_CC: 'mbc0masterCC',
    MBC_PROCESS_RESOURCE_TYPE: 'mbc0processResourceType',
    MBC_ATTACHED_FILES: 'mbc0AttachedFiles',
    MBC_ATTACHED_DATASET: 'mbc0AttachedDataset',
    MBC_HAS_SUB_ELEMENTS: 'mbc0hasSubElements',
    MBC_WORKAREA_ELEMENT: 'Mbc0WorkAreaElement',

    // TC
    OBJECT_STRING: 'object_string',
    USER: 'user',
    ITEM_REVISION: 'ItemRevision',
    DATASET_REFERENCES: 'ref_list',
    RELATED_OBJECT_CHILDREN_KEY: 'childAssembly',

    // General
    MACHINE_TYPE: 'Machine',
    IMAN_ITEM_BOP_LINE: 'ImanItemBOPLine',
    EBOM: 'EBOM',

    //Change Indications
    CHANGE_INDICATION: 'ChangeIndication',
    CHANGE_PART_INDICATION: 'ChangePartIndication',

    //Relation
    IMAN_SPECIFICATION: 'IMAN_specification',

    //occurence types
    ME_CONSUMED: 'MEConsumed',

    //MCI or PMI
    MCI_PMI_CHARACTERISTIC: 'Mci0PMICharacteristic',
    MCI_PMI_DESCRIPTION: 'mci0PmiDescription',
    MCI_PMI_META_DATA: 'Mci0PMIMetaData',
    PMI_ASSEMBLY_PMIS_PSEUDO_PROP: 'assemblyPMIs',
    PMI_CHARACTERISTICS_PSEUDO_PROP: 'characteristics',
    PMI_RELATED_PMI_PSEUDO_PROP: 'realatedPmi',
    PMI_CONNECTED_PARTS_PSEUDO_PROP: 'connectedParts',

    //workflow
    IN_PROCESS: 'bl_rev_fnd0InProcess',
    LAST_RELEASE_STATUS_ATTR: 'awb0RevisionRelStatusList',
    BL_REV_ALLWORKFLOW: 'bl_rev_fnd0AllWorkflows',

    // BOP Breakdown constants
    TARGET_ASSEMBLY_PROPERTY: 'mbc0TargetAssemblies',
    ASSOCIATED_PROCESS_PROPERTY: 'mbc0AssociatedProcesses',

    // Object types
    GIF_OBJECT_TYPE: 'GIF',
    JPEG_OBJECT_TYPE: 'JPEG',
    BITMAP_OBJECT_TYPE: 'Bitmap',
    SNAPSHOT_OBJECT_TYPE: 'SnapShotViewData',
    IMAGE_OBJECT_TYPE: 'Image',
    WEB_LINK_OBJECT_TYPE: 'Web Link',
    FULL_TEXT_OBJECT_TYPE: 'FullText',
    CME_REPORT_OBJECT_TYPE: 'CME_Report'
};

export default { constants };
