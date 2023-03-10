// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * File to maintain constants for cadbomalignment module
 *
 * @module js/cbaConstants
 */
const cbaConstants = {

    CBA_SRC_CONTEXT: 'CBASrcContext',
    CBA_TRG_CONTEXT: 'CBATrgContext',

    ALIGNED_DESIGNS_PROVIDER: 'Fnd0AlignedDesignsProvider',
    ALIGNED_PARTS_PROVIDER: 'Fnd0AlignedPartsProvider',

    CTX_PATH_SRC_STRUCTURE: 'cbaContext.srcStructure',
    CTX_PATH_TRG_STRUCTURE: 'cbaContext.trgStructure',
    CTX_PATH_LINKEDBOM_DATAPROVIDER_NAME: 'cbaContext.linkedBOM.dataProviderName',
    CTX_PATH_LINKEDBOM_SECTION_NAME: 'cbaContext.linkedBOM.sectionName',
    CTX_PATH_LINKEDBOM_RELATEDMODELOBJECTS: 'cbaContext.linkedBOM.relatedModelObjects',
    CTX_PATH_SPLIT_VIEW: 'splitView',
    CTX_PATH_SPLIT_VIEW_MODE: 'splitView.mode',
    CTX_PATH_SPLIT_VIEW_VIEWKEYS: 'splitView.viewKeys',
    CTX_PATH_ALIGNMENT_CHECK_INFO :'cbaContext.alignmentCheckContext.alignmentCheckInfo',
    CTX_PATH_PART_DESIGN_QUALIFIER : 'cbaContext.partDesignQualifier',
    CTX_PATH_DO_NOT_CLEAR_CBA_VARS : 'cbaContext.doNotClearCBAContextVars',
    CTX_PATH_IMPACT_ANALYSIS : 'cadbomalignment.ImpactAnalysis',
    CTX_PATH_SUBLOCATION_NAMETOKEN : 'sublocation.nameToken',
    CTX_PATH_ELEMENT_TO_PCI_MAP: 'aceActiveContext.context.elementToPCIMap',
    CTX_PATH_PRODUCT_CONTEXT_INFO_UID :'aceActiveContext.context.productContextInfo.uid',
    CTX_PATH_SELECT_ALIGNED_LINE :'cbaContext.selectAlignedLine',
    CTX_PATH_FIND_ALIGNED_INFO :'cbaContext.findAlignedContext.findAlignedInfo',
    CTX_PATH_ARE_MULTI_STR_IN_CBA :'cadbomalignment.commands.areMultipleStructuresInCBA',
    CTX_PATH_IS_SINGLE_SELECT_IN_SRC:'cadbomalignment.commands.isSingleSelectionInSrc',
    CTX_PATH_IS_SINGLE_SELECT_IN_TRG:'cadbomalignment.commands.isSingleSelectionInTrg',
    CTX_PATH_SRC_SELECTED_OBJECTS:'cadbomalignment.selection.source',
    CTX_PATH_TRG_SELECTED_OBJECTS:'cadbomalignment.selection.target',


    PART_DESIGN_QUALIFIER : 'Fnd0PartDesignQualifier',
    DESIGN : 'Design',
    PART : 'Part',
    PRODUCT_EBOM : 'ProductEBOM',
    MULTI_DOMAIN_PART_OR_DESIGN : 'MultiDomainPartOrDesign',

    ALIGNMENT_RELATION_PRODUCT_EBOM : 'Fnd0DesignToBomLink',
    ALIGNMENT_RELATION_PART_EBOM : 'TC_Is_Represented_By',
    ALIGNMENT_RELATION_DESIGN_DBOM : 'representation_for',

    LINKED_ENGINEERING_BOM : 'LinkedEngineeringnBOM',
    LINKED_DESIGN_BOM : 'LinkedDesignBOM',

    FND_ALIGNED_DESIGN : 'Fnd0AlignedDesign',
    FND_ALIGNED_PART : 'Fnd0AlignedPart',
    LINKED_ITEM_PROVIDER: 'Ebm0LinkedProductsProvider',
    ITEM_REVISION : 'ItemRevision',

    SR_UID_PREFIX : 'SR::N::',

    INTENT_FIND_ALIGNED: 'findAligned',
    INTENT_CROSS_PROBE: 'crossProbe'
};

export default cbaConstants;
