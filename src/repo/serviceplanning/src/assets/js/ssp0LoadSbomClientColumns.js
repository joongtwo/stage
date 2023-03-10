// Copyright (c) 2022 Siemens

/**
 * Service for ep graphic visibility table column renderer
 *
 * @module js/ssp0LoadSbomClientColumns
 */
import awColumnSvc from 'js/awColumnService';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import localeService from 'js/localeService';

let exports = {};

/**
 * Method to create the client-only SBOM Columns
 * @param {Object} data The declarative data view model object.
 */
export let loadSbomClientColumns = function( data ) {
    let sbomClientColumns = [];
    appCtxSvc.updateCtx( 'sbomClientColumns', sbomClientColumns );
    loadPLFColumns();
    data.sbomClientColumns = appCtxSvc.getCtx( 'sbomClientColumns' );
    exports.data = data;
    appCtxSvc.unRegisterCtx( 'sbomClientColumns' );
};

/**
 * Method to create the client-only PLF Columns
 */
let loadPLFColumns = function() {
    let sbomClientColumns = appCtxSvc.getCtx( 'sbomClientColumns' );
    let displayName;
    let columnOrder = 1000;
    let columnNames = [ 'traceableValueColumn', 'serializedValueColumn', 'lotValueColumn', 'pQuantityValueColumn', 'rotableValueColumn', 'consumableValueColumn' ];
    const map = appCtxSvc.getCtx( 'PLFDisplayNames' );

    if ( map.has( 'assetValueColumn' ) ) {
        columnNames.push( 'assetValueColumn' );
    }

    for ( let itr = 0; itr < columnNames.length; itr++ ) {
        columnOrder += 10;
        if ( map ) {
            displayName = map.get( columnNames[itr] );
            if ( !displayName ) {
                displayName = getLocalizedMessage( 'ssp0Messages', columnNames[itr], null );
            }
        }

        let width = 90;
        if ( columnNames[itr] === 'pQuantityValueColumn' ) { width = 110; }
        sbomClientColumns.push( awColumnSvc.createColumnInfo( {
            name: columnNames[itr],
            displayName: displayName,
            propertyName: columnNames[itr],
            minWidth: 30,
            width: width,
            columnOrder: columnOrder,
            clientColumn: true,
            enableFiltering: false,
            enableColumnResizing: false,
            enablePinning: false,
            enableColumnHiding: true,
            enableSorting: false,
            enableCellEdit: true,
            enableColumnMoving: true,
            visible: true,
            modifiable: true
        } ) );
    }
};


/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {Object} resourceFile - File that defines the message
 * @param {String} resourceKey - The message key which should be looked-up
 * @param {String} messageParam - The message parameter
 * @returns {String} localizedValue - The localized message string
 */
function getLocalizedMessage( resourceFile, resourceKey, messageParam ) {
    let localizedValue = null;
    let resource = resourceFile;
    let localTextBundle = localeService.getLoadedText( resource );
    if ( localTextBundle ) {
        localizedValue = localTextBundle[resourceKey].replace( '{0}', messageParam );
    } else {
        let asyncFun = function( localTextBundle ) {
            localizedValue = localTextBundle[resourceKey].replace( '{0}', messageParam );
        };
        localeService.getTextPromise( resource ).then( asyncFun );
    }
    return localizedValue;
}


/**
 * Calls a SOA to get the displaynames of PLF attributes
 *
 */
export let soaCallForPLFDisplayNames = function() {
    let map = new Map();

    let input = {
        typeNames: [ 'PartLogisticsForm' ],
        options: {
            PropertyExclusions: [ 'LovReferences', 'NamingRules', 'RendererReferences' ],
            TypeExclusions: [ 'DirectChildTypesInfo', 'RevisionNamingRules', 'ToolInfo' ]
        }
    };
    soaSvc.post( 'Core-2015-10-Session', 'getTypeDescriptions2', input ).then( function( response ) {
        let typeDescriptionsList = response.types[0].propertyDescriptors;

        for ( let i = 0; i < typeDescriptionsList.length; i++ ) {
            if ( typeDescriptionsList[i].name === 'isTraceable' ) {
                map.set( 'traceableValueColumn', typeDescriptionsList[i].displayName );
            } else if ( typeDescriptionsList[i].name === 'isSerialized' ) {
                map.set( 'serializedValueColumn', typeDescriptionsList[i].displayName );
            } else if ( typeDescriptionsList[i].name === 'isLot' ) {
                map.set( 'lotValueColumn', typeDescriptionsList[i].displayName );
            } else if ( typeDescriptionsList[i].name === 'preserveQuantity' ) {
                map.set( 'pQuantityValueColumn', typeDescriptionsList[i].displayName );
            } else if ( typeDescriptionsList[i].name === 'isRotable' ) {
                map.set( 'rotableValueColumn', typeDescriptionsList[i].displayName );
            } else if ( typeDescriptionsList[i].name === 'isConsumable' ) {
                map.set( 'consumableValueColumn', typeDescriptionsList[i].displayName );
            } else if ( typeDescriptionsList[i].name === 'sse0isAsset' ) {
                map.set( 'assetValueColumn', typeDescriptionsList[i].displayName );
            }
        }
        appCtxSvc.updateCtx( 'PLFDisplayNames', map );
    } );
    appCtxSvc.updateCtx( 'PLFDisplayNames', map );
};

export default exports = {
    soaCallForPLFDisplayNames,
    loadSbomClientColumns
};
