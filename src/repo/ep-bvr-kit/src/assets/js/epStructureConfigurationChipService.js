// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for ep chip configuration
 *
 * @module js/epStructureConfigurationChipService
 */
import localeService from 'js/localeService';
import appCtxSvc from 'js/appCtxService';
/**
 *
 * @param {Array} configData configData
 * @returns{Object} Work package related information
 */
function getWPStructuresList( configData ) {
    let epTaskPageContext = appCtxSvc.getCtx( 'epTaskPageContext' );
    const structuresConfigData = [];
    const resource = localeService.getLoadedText( 'structureConfigurationMessages' );
    for( const structure of configData ) {
        if( structure.pci !== undefined ) {
            let structuresConfigDataList = {};
            if( structure.structureName in epTaskPageContext ) {
                let matObjProps = epTaskPageContext[structure.structureName].props;
                structuresConfigDataList = {
                    chipLabel:structure.chipLabel,
                    revision: {
                        dispValue: matObjProps.awb0CurrentRevRule.uiValues[0],
                        splitter: true,
                        labelPosition: 'NO_PROPERTY_LABEL'
                    }
                };
                if(  matObjProps.awb0EffDate.uiValues[ 0 ] !== '' ) {
                    structuresConfigDataList.date = {
                        dispValue: matObjProps.awb0EffDate.uiValues[ 0 ],
                        splitter: true,
                        labelPosition: 'NO_PROPERTY_LABEL'
                    };
                }
                if(  matObjProps.awb0EffUnitNo.uiValues[ 0 ] !== '' ) {
                    let endItem =  matObjProps.awb0EffEndItem.uiValues[ 0 ] !== '' ?  matObjProps.awb0EffEndItem.uiValues[ 0 ] : structure.context.props.object_string.uiValues[0];
                    structuresConfigDataList.units = {
                        dispValue:  matObjProps.awb0EffUnitNo.uiValues[ 0 ] + ' (' + endItem + ')',
                        unit:resource.awb0EffUnitNoLabel + ': ' +  matObjProps.awb0EffUnitNo.uiValues[ 0 ],
                        endItem:resource.endItem + ': ' + endItem,
                        splitter: true,
                        labelPosition: 'NO_PROPERTY_LABEL'
                    };
                }
                if( matObjProps.awb0VariantRules !== undefined  && matObjProps.awb0VariantRules.uiValues.length > 0 ) {
                    structuresConfigDataList.variant = {
                        dispValue : matObjProps.awb0VariantRules.uiValues[ 0 ] + ' (' + matObjProps.awb0Product.uiValues[ 0 ] + ')',
                        splitter: true,
                        variant: matObjProps.awb0VariantRules.uiValues[ 0 ],
                        endItem:matObjProps.awb0EffEndItem.uiValues[ 0 ],
                        labelPosition: 'NO_PROPERTY_LABEL'
                    };
                }
                if ( structure.confligFlags.show_unconfigured_effectivity[0] === 'true' ) {
                    structuresConfigDataList.excludedByEffectivityFlag = true;
                }
                if ( structure.confligFlags.show_unconfigured_variants[0] === 'true' ) {
                    structuresConfigDataList.excludedByVariantFlag = true;
                }
                if ( structure.confligFlags.show_unconfigured_assignment !== undefined && structure.confligFlags.show_unconfigured_assignment[0] === 'true' ) {
                    structuresConfigDataList.excludedByAssignmentFlag = true;
                }
            }
            structuresConfigData.push( structuresConfigDataList );
        }
    }
    return structuresConfigData;
}

export default {
    getWPStructuresList
};
