// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/cbaTaskbarCommandService
 */

import appCtxSvc from 'js/appCtxService';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import cbaConstants from 'js/cbaConstants';

/**
 * Check if the value is present in given preference
 * @param {string} preferenceName Name of preference in which value to check
 * @param {string} value value to check in preference
 * @returns {boolean} true if value is present in preference else false.
 */
let _checkValueInPreference = ( preferenceName, value ) => {
    let preferenceValues = appCtxSvc.getCtx( 'preferences.' + preferenceName );
    return preferenceValues && preferenceValues.includes(value)?true:false;
};

/**
 * Get property object for context
 * @param {*} context OccContext object
 * @returns {Object} - Property object
 */
let _getPropObjFromContext = ( context ) => {
    let propObj = {
        openedElement: context.openedElement,
        selectedModelObjects: context.selectedModelObjects,
        topElement: context.topElement,
        viewKey: context.viewKey,
        vmc: context.vmc,
        isRowSelected: null,
        isTopSelected: false,
        isTopDefaultSelected: false,
        areMultipleSelected: false,
        isSingleVisibleSelected: false,
        isPartRequired: null,
        isDesignRequired: null,
        isPartOrDesignRequired: null,
        isVISelected: null,
        isSelectionSVProductOcc: null,
        isUnconfiguredSelected: null,
        isSelectionProductOcc:null
    };

    propObj.isRowSelected = Boolean( context.isRowSelected );

    if ( context.selectedModelObjects && Array.isArray( context.selectedModelObjects ) && context.topElement ) {
        //Top selected
        propObj.isTopSelected = context.selectedModelObjects.some( selectedModelObject => {
            return context.isRowSelected && context.topElement.uid === selectedModelObject.uid;
        } );

        //Top default selected
        propObj.isTopDefaultSelected = context.selectedModelObjects.some( selectedModelObject => {
            return !context.isRowSelected && context.topElement.uid === selectedModelObject.uid;
        } );

        // Are Multiple Selected (Consider single packed line as multiple lines)
        propObj.areMultipleSelected = context.selectedModelObjects.length > 1;
        if ( !propObj.areMultipleSelected ) {
            propObj.areMultipleSelected = context.selectedModelObjects.some( selectedModelObject => {
                return selectedModelObject.props.awb0IsPacked && selectedModelObject.props.awb0IsPacked.dbValues[0] === '1';
            } );
        }

        // Is Single Visible Selected (Packed line is also consider as single line)
        propObj.isSingleVisibleSelected = context.selectedModelObjects.length === 1;

        // Is Part required
        propObj.isPartRequired = context.selectedModelObjects.every( selectedModelObject => {
            return selectedModelObject.props.pma1IsPartRequired && selectedModelObject.props.pma1IsPartRequired.dbValues[0] === '1';
        } );

        // Is Design required
        propObj.isDesignRequired = context.selectedModelObjects.every( selectedModelObject => {
            return selectedModelObject.props.pma1IsDesignRequired && selectedModelObject.props.pma1IsDesignRequired.dbValues[0] === '1';
        } );

        propObj.isPartOrDesignRequired = propObj.isPartRequired || propObj.isDesignRequired;

        let underlyingObjectType = propObj.isSingleVisibleSelected && context.selectedModelObjects[0].props.awb0UnderlyingObjectType;
        propObj.isSelectionProductOcc = underlyingObjectType ? _checkValueInPreference( 'FND0_PRODUCTEBOMREVISION_TYPES', underlyingObjectType.dbValues[0] ) : false;

        // Is VI
        propObj.isVISelected = context.selectedModelObjects.every( selectedModelObject => {
            return selectedModelObject.props.awb0IsVi && selectedModelObject.props.awb0IsVi.dbValues[0] === '1';
        } );

        if ( propObj.isVISelected && propObj.isSelectionProductOcc ) {
            propObj.isSelectionSVProductOcc = true;
        }

        // Is Unconfigured selected
        propObj.isUnconfiguredSelected = context.selectedModelObjects.some( selectedModelObject => {
            return selectedModelObject.props.awb0Archetype.dbValues[0] === null;
        } );
    }
    return propObj;
};

/**
 * Update CTX with taskbar commands visibility state
 * @param {Object} srcContext Source occContext
 * @param {Object} trgContext target occContext
 */
export const updateContextForTaskbarCmds = ( srcContext, trgContext ) => {
    if ( !srcContext && !trgContext ) {
        return;
    }

    let srcPropObj;
    let trgPropObj;
    if ( srcContext ) {
        srcPropObj = _getPropObjFromContext( srcContext );
    }

    if ( trgContext ) {
        trgPropObj = _getPropObjFromContext( trgContext );
    }

    let areMultipleStructureInCBA = srcPropObj && srcPropObj.openedElement && trgPropObj && trgPropObj.openedElement ? true : false;
    let isRowSelectionInSrcOrTrg = srcPropObj && srcPropObj.isRowSelected || trgPropObj && trgPropObj.isRowSelected;

    let alignCmdCondition;
    let unAlignCmdCondition;
    let alignmentCheckCmdCondition;
    let isAlignCommandAvailableForTop;
    let isUnalignCommandAvailableForTop;
    if ( areMultipleStructureInCBA ) {
        let isAnyTopSelected = srcPropObj.isTopSelected || trgPropObj.isTopSelected ? true : false;
        let isRowSelectionInSrcAndTrg = srcPropObj.isRowSelected && trgPropObj.isRowSelected;
        let areMultipleSrcOrTrgSelected = srcPropObj.areMultipleSelected || trgPropObj.areMultipleSelected;
        let areMultipleSrcAndTrgSelected = srcPropObj.areMultipleSelected && trgPropObj.areMultipleSelected;
        let isDesignOrPartRequired = srcPropObj.isPartOrDesignRequired && trgPropObj.isPartOrDesignRequired;
        let isUnconfiguredSrcOrTrgLineSelected = srcPropObj.isUnconfiguredSelected || trgPropObj.isUnconfiguredSelected;

        // AlignCommandCondition
        alignCmdCondition = !isAnyTopSelected && isRowSelectionInSrcAndTrg && !areMultipleSrcOrTrgSelected &&
            ( isDesignOrPartRequired || trgPropObj.isSelectionSVProductOcc ) && !isUnconfiguredSrcOrTrgLineSelected;


        // UnAlignCommandCondition
        let isOneToManySelected = isRowSelectionInSrcAndTrg && areMultipleSrcOrTrgSelected;
        unAlignCmdCondition = !isAnyTopSelected && isRowSelectionInSrcOrTrg && !areMultipleSrcAndTrgSelected && areMultipleStructureInCBA &&
            !isOneToManySelected && ( isDesignOrPartRequired || trgPropObj.isSelectionSVProductOcc ) && !isUnconfiguredSrcOrTrgLineSelected;

        // AlignmentCheckCommandCondition
        let isSingleRowSelectionInOnlySrcIncludePackedLines = srcPropObj.isRowSelected && !trgPropObj.isRowSelected &&
            srcPropObj.isSingleVisibleSelected && srcPropObj.isPartRequired;
        let isOnlySourceTopSelected = srcPropObj.isTopSelected && !trgPropObj.isRowSelected && srcPropObj.isSingleVisibleSelected;
        let isSingleRowSelectionInOnlyTrgIncludePackedLines = !srcPropObj.isRowSelected && trgPropObj.isRowSelected &&
            trgPropObj.isSingleVisibleSelected && trgPropObj.isDesignRequired;
        let isOnlyTargetTopSelected = trgPropObj.isTopSelected && !srcPropObj.isRowSelected && trgPropObj.isSingleVisibleSelected;
        let areOnlySourceAndTargetTopSelected = srcPropObj.isTopSelected && srcPropObj.isSingleVisibleSelected &&
            trgPropObj.isTopSelected && trgPropObj.isSingleVisibleSelected;
        let isOnlySVProductOccInTrgSelection = !srcPropObj.isRowSelected && trgPropObj.isSelectionSVProductOcc;

        let isMultiDomainPartOrDesignSelectedInSrc = srcPropObj.isSingleVisibleSelected &&
            CadBomOccurrenceAlignmentUtil.getObjectQualifierTypeFromVMO( srcPropObj.selectedModelObjects[0] ) === cbaConstants.MULTI_DOMAIN_PART_OR_DESIGN;

        let isMultiDomainPartOrDesignSelectedInTrg = trgPropObj.isSingleVisibleSelected &&
            CadBomOccurrenceAlignmentUtil.getObjectQualifierTypeFromVMO( trgPropObj.selectedModelObjects[0] ) === cbaConstants.MULTI_DOMAIN_PART_OR_DESIGN;

        let multiDomainPartOrDesignObjectConditionForAlignmentCheck = ( isMultiDomainPartOrDesignSelectedInSrc || isMultiDomainPartOrDesignSelectedInTrg ) && !areMultipleSrcOrTrgSelected;

        let isSelectionValidForAccCheck = isSingleRowSelectionInOnlySrcIncludePackedLines || isOnlySourceTopSelected ||
            isSingleRowSelectionInOnlyTrgIncludePackedLines || isOnlyTargetTopSelected || !isRowSelectionInSrcOrTrg || areOnlySourceAndTargetTopSelected ||
            isOnlySVProductOccInTrgSelection || multiDomainPartOrDesignObjectConditionForAlignmentCheck;

        alignmentCheckCmdCondition = isSelectionValidForAccCheck && areMultipleStructureInCBA;

        isAlignCommandAvailableForTop = areOnlySourceAndTargetTopSelected && !isUnconfiguredSrcOrTrgLineSelected &&
        ( isDesignOrPartRequired || trgPropObj.isSelectionProductOcc );

        isUnalignCommandAvailableForTop = ( isOnlySourceTopSelected || isOnlyTargetTopSelected || areOnlySourceAndTargetTopSelected ) &&
        !isUnconfiguredSrcOrTrgLineSelected && ( isDesignOrPartRequired || trgPropObj.isSelectionProductOcc );
    }

    // DeselectAllCommandCondition
    let deselectAllCmdCondition = isRowSelectionInSrcOrTrg;

    let commands = {
        isAlignCmdVisible: Boolean( alignCmdCondition ),
        isUnAlignCmdVisible: Boolean( unAlignCmdCondition ),
        isAlignmentCheckCmdVisible: Boolean( alignmentCheckCmdCondition ),
        isDeselectAllCmdVisible: Boolean( deselectAllCmdCondition ),
        isAlignCmdForTopVisible: Boolean( isAlignCommandAvailableForTop ),
        isUnalignCmdForTopVisible: Boolean( isUnalignCommandAvailableForTop ),
        areMultipleStructuresInCBA: Boolean( areMultipleStructureInCBA ),
        isSingleSelectionInSrc: Boolean( srcPropObj && srcPropObj.isRowSelected ),
        isSingleSelectionInTrg: Boolean( trgPropObj && trgPropObj.isRowSelected )
    };
    let selection = {
        source:srcPropObj ? srcPropObj.selectedModelObjects : [],
        target:trgPropObj ? trgPropObj.selectedModelObjects : []
    };
    updateCadbomalignmentOnCtx( 'commands', commands );
    updateCadbomalignmentOnCtx( 'selection', selection );
};

/**
 * Returns taskbar context with updated source and target context values
 * @param {Object} taskBarContext taskbar context
 * @param {Object} updatedData values to be updated on taskBarContext
 */
 export const updateTaskBarContext = function( taskBarContext, updatedData ) {
    let newValues = Object.assign( taskBarContext, updatedData );
    return taskBarContext.update( newValues );
};

/**
 * Update cadBomAlignment data on ctx
 * @param {string} key key where we need to update the values
 * @param {Object} valueToUpdate Values to be updated on ctx.cadbomalignment
 */
export const updateCadbomalignmentOnCtx = function( key, valueToUpdate ) {
    appCtxSvc.updatePartialCtx( 'cadbomalignment.' + key, valueToUpdate );
};

const exports = {
    updateContextForTaskbarCmds,
    updateCadbomalignmentOnCtx,
    updateTaskBarContext
};

export default exports;
