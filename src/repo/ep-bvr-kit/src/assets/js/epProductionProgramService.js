// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Production Program Related Service
 *
 * @module js/epProductionProgramService
 */
import { constants as epLoadConstants } from 'js/epLoadConstants';
import epContextService from 'js/epContextService';
import cdm from 'soa/kernel/clientDataModel';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import mfeVMOService from 'js/services/mfeViewModelObjectLifeCycleService';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import appCtxService from 'js/appCtxService';
import localeService from 'js/localeService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import mfeTableService from 'js/mfeTableService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import _ from 'lodash';
/**
 * Get productVariants from cache
 *
 * @returns {StringList} the productVariants uid list from cache
 */
export function getProductVariantsFromCache() {
    let productVariants = [];
    const productionProgram = appCtxService.getCtx( 'epTaskPageContext' ).productionProgramCollection;
    if( productionProgram ) {
        productVariants = epObjectPropertyCacheService.getProperty( productionProgram.uid, 'productVariants' );
    }
    epContextService.setPageContext( 'hasProductVariants', productVariants.length > 0 );
    return productVariants;
}

/**
 * Get productVariants VMOS
 * @param {*} productVariantsFromCache list of uids
 * @returns {VMO} the productVariants VMOS
 */
function getProductVariantsVMOS( productVariantsFromCache ) {
    return productVariantsFromCache.map( ( uid ) => {
        const vmo = mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( uid ) );
        vmo.props.bl_rev_object_name.editable = false;
        vmo.props.bl_rev_object_name.isPropertyModifiable = false;
        return vmo;
    } );
}

/**
 * Load Production Program
 *
 * @returns {object} Production program
 */
function loadProductionProgram( objectUid ) {
    const loadTypeInput = epLoadInputHelper.getLoadTypeInputs( [ epLoadConstants.PRODUCTION_PROGRAM ], objectUid );
    return epLoadService.loadObject( loadTypeInput, false ).then( ( response ) => response.loadedObjectsMap.productionProgramCollection );
}

/**
 * Gets Configurator Context Name and Modifies loacal text bundle
 * @returns {string} localization message
 */
function updateCreatePVSIfEmptyMessage( vmProp ) {
    const epTaskPageContext = appCtxService.getCtx( 'epTaskPageContext' );
    const localTextBundle = localeService.getLoadedText( 'AdminMessages' );
    const configuratorContextObj = epTaskPageContext.configuratorContext;
    const newVmProp = _.clone( vmProp );
    newVmProp.uiValue = localTextBundle.createPVSIfEmpty.format( configuratorContextObj.props.object_string.dbValues[ 0 ] );
    return newVmProp;
}

/**
 * Gets Configurator Context Name and Modifies loacal text bundle
 * @returns {string} localization message
 */
function generateProductVariants() {
    const epTaskPageContext = appCtxService.getCtx( 'epTaskPageContext' );
    const productionProgramCollection = epTaskPageContext.productionProgramCollection;
    let newObjectUID = mfeViewModelUtils.generateUniqueId( 'new_object_id' );

    const objectMap = {
        id: newObjectUID,
        connectTo: productionProgramCollection.uid,
        Type: 'Mfg0MEProdVarian'
    };
    const source = {
        source: 'ConfiguratorContext'
    };
    const propsMap = {
        additionalPropMap: source,
        itemPropMap: source
    };

    const saveInputWriter = saveInputWriterService.get();
    saveInputWriter.addCreateObject( objectMap, propsMap );
    return epSaveService.saveChanges( saveInputWriter, true, [ productionProgramCollection ] );
}

/**
 * Get productVariants VMOS from SOA
 *
 * @param {*} saveEvent saveEvent
 * @param {*} inputObjectUid inputObjectUid
 * @returns {Array} the productVariants VMOS
 */
export function getProductVariantsFromEventData( saveEvent ) {
    const uid = saveEvent[ epBvrConstants.MFG_PRODUCT_VARIANTS ][ 0 ].eventObjectUid;
    let objUidToAddList = [];
    let relevantEvents = saveEvent[ epBvrConstants.MFG_PRODUCT_VARIANTS ];
    if( relevantEvents ) {
        if( !Array.isArray( relevantEvents ) ) {
            relevantEvents = [ relevantEvents ];
        }
        relevantEvents.forEach( ( event ) => {
            if( event.eventObjectUid === uid ) {
                const relatedEvents = event.relatedEvents;
                objUidToAddList = relatedEvents[ epSaveConstants.CREATE_DATASET_RELATION ];
            }
        } );
    }
    return objUidToAddList;
}

/**
 * getTotalProductionRate
 * @param {*} productVariants all pvs
 * @returns {Integer} sum of all production rates
 */
export function getTotalProductionRate( productVariants ) {
    if( !productVariants || productVariants.length === 0 || !Array.isArray( productVariants ) ) { return 0; }
    const totalProductionRate = _.reduce( productVariants, ( sum, pv ) => {
        return sum + parseInt( pv.props[ epBvrConstants.MFG_PRODUCTION_RATE ].uiValues[ 0 ] );
    }, 0 );

    _.each( productVariants, pv => _.assign( pv, { totalProductionRate } ) );
    return totalProductionRate;
}

/**
 * parseSaveEvent
 * @param {*} saveEvent the event
 * @returns {String} CREATED/DELETED/MODIFIED
 */
export function parseSaveEvent( saveEvent ) {
    if( saveEvent[ epBvrConstants.MFG_PRODUCT_VARIANTS ] ) { return 'CREATED'; }
    if( saveEvent[ epBvrConstants.MFG_PRODUCTION_RATE ] ) { return 'MODIFIED'; }
    if( saveEvent.DELETED_PVS ) { return 'DELETED'; }
    return '';
}

/**
 * removeProductVariants
 * @param {*} saveEvents the delete save events
 * @param {*} productVariantsList current pvs list
 * @returns {Array} new pvs list
 */
export function removeProductVariants( saveEvents, productVariantsList ) {
    const removedUids = _.reduce( saveEvents.DELETED_PVS, ( result, removedObject ) => {
        return _.concat( result, removedObject.eventObjectUid );
    }, [] );

    return _.filter( productVariantsList, pv => !_.includes( removedUids, pv.uid ) );
}

/**
 * addProbabilityColumn
 * @param {*} columns the existing columns
 * @returns {Array} new columns with probability
 */
export function addProbabilityColumn( columns ) {
    const localTextBundle = localeService.getLoadedText( 'AdminMessages' );
    const rateColumn = columns.find( column => column.name === epBvrConstants.MFG_PRODUCTION_RATE );
    if( !rateColumn ) {
        return columns;
    }

    const rateColumnIndex = _.findIndex( columns, rateColumn );
    columns.splice( rateColumnIndex + 1, 0, mfeTableService.createHardCodedClientColumnInfo( {
        name: 'probability',
        propertyName: 'probability',
        displayName: localTextBundle.probability,
        width: 100
    } ) );
    return columns;
}

/**
 * renderProductVariantProbability
 * @param {*} vmo the pv object
 * @param {*} containerElement dom elem to render
 */
export function renderProductVariantProbability( vmo, containerElement ) {
    if( vmo.props[ epBvrConstants.MFG_PRODUCTION_RATE ] && vmo.totalProductionRate ) {
        const probability = vmo.props[ epBvrConstants.MFG_PRODUCTION_RATE ].uiValue / vmo.totalProductionRate * 100;
        containerElement.append( parseFloat( probability.toFixed( 2 ) ) );
    }
}

export default {
    getProductVariantsFromCache,
    getProductVariantsVMOS,
    loadProductionProgram,
    updateCreatePVSIfEmptyMessage,
    generateProductVariants,
    getProductVariantsFromEventData,
    getTotalProductionRate,
    parseSaveEvent,
    removeProductVariants,
    addProbabilityColumn,
    renderProductVariantProbability
};
