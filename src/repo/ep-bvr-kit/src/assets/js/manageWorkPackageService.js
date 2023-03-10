// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* global
 define
 */

/**
 * @module js/manageWorkPackageService
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import localeService from 'js/localeService';
import mfeVMOLifeCycleSvc from 'js/services/mfeViewModelObjectLifeCycleService';
import preferenceService from 'soa/preferenceService';

const WORKPACKAGE_CONTENT_TYPE_PREFERENCE = 'EP_WorkPackageContentType';
const PRODUCT_VARIANTS_TILES_PREFERENCE = 'EP_ProductVariantsTiles';



/**
 * Creates view model data for manage tiles
 *@param {Object} context - subPanelContext of the view
 */
export function addVMOAndRevRuleToStructureContext( contextPath ) {
    if( contextPath ) {
        const context = appCtxService.getCtx( contextPath );
        if( context ) {
            const revisionObject = cdm.getObject( epObjectPropertyCacheService.getProperty( context.uid, 'bl_revision' ) );
            const revisionRuleObject = cdm.getObject( epObjectPropertyCacheService.getProperty( context.uid, 'revisionRule' ) );
            if( revisionObject ) {
                const vmo = mfeVMOLifeCycleSvc.createViewModelObjectFromUid( revisionObject.uid );
                appCtxService.updatePartialCtx( `${contextPath}.vmo`, vmo );
            }
            if( revisionRuleObject ) {
                appCtxService.updatePartialCtx( `${contextPath}.revisionRule`, revisionRuleObject.props.object_string.dbValues[ 0 ] );
            }
        }
    }
}

/**
 * Creates structure to display different tiles. List of structures to be displayed is decided based on
 * 'EP_WorkPackageContentType' preference values. Preference contains values like StructureType1:ContentType1.
 * e.g EBOM:Item, PlantBOP:ItemRevision, etc. This method fetches the structureTypes from these values.
 *
 * Also, in BTO, when there is only single BOM used, this will be treated as MBOM. In future,We should check
 * if the workpackage has single BOM configured using a preference.

 * @returns { Object } contentPanelData / structureList
 */
export function getWPStructuresList() {
    const localTextBundle = localeService.getLoadedText( 'AdminMessages' );
    return preferenceService.getStringValues( WORKPACKAGE_CONTENT_TYPE_PREFERENCE ).then( ( structureTypes ) => {
        return structureTypes.map( ( structure ) => {
            const contentPanelData = {};
            const structureName = structure.indexOf( ':' ) > -1 ? structure.split( ':' )[ 0 ] : structure;
            //for BTO, check if only MBOM is configured. If yes, then name it as Product.
            const isEBOMPartOfPreference = ( element ) => element.indexOf( 'EBOM' ) > -1;
            if( structureName === 'MBOM' && !structureTypes.some( isEBOMPartOfPreference ) ) {
                contentPanelData.tabs = [ {
                    name: localTextBundle.productTileTitle,
                    tabKey: 'EpProductTile'
                } ];
            } else {
                contentPanelData.tabs = [ {
                    name: localTextBundle[ `${structureName.toLowerCase()}TileTitle` ],
                    tabKey: `Ep${structureName}Tile`
                } ];
            }

            return contentPanelData;
        } );
    } );
}

function getProductVariantsStructuresList() {
    const localTextBundle = localeService.getLoadedText( 'AdminMessages' );
    return preferenceService.getStringValues( PRODUCT_VARIANTS_TILES_PREFERENCE ).then( ( structureTypes ) => {
        const context = appCtxService.getCtx();
        const structureList = structureTypes.filter( ( structure ) => {
            if( structure === 'ProductionProgram' ) {
                if( context.preferences.EP_WorkPackageContentType.includes( 'PlantBOP:PSBOMViewRevision' ) && context.preferences.EP_ProductVariantsTiles.includes( 'ProductionProgram' ) ) {
                    return true;
                }
                return false;
            }
            return true;
        } );
        return structureList.map( ( structure ) => {
            return {
                name: localTextBundle[ `${structure.toLowerCase()}TileTitle` ],
                tabKey: `Ep${structure}Tile`,
                uiAnchor: `Ep${structure}Tile_uiAnchor`
            };
        } );
    } );
}

export default {
    addVMOAndRevRuleToStructureContext,
    getWPStructuresList,
    getProductVariantsStructuresList
};
