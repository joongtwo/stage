// Copyright (c) 2022 Siemens

/**
 * Defines a service that can accept a chain of Clone Stable Ids (CSIDs) and fetch and return model objects
 * corresponding to those.
 *
 * @module js/csidsToObjectsConverterService
 */
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import soaService from 'soa/kernel/soaService';
import _ from 'lodash';

let exports = {}; // eslint-disable-line no-invalid-this

const excludeUiValues = {
    name: 'excludeUiValues',
    Value: 'true'
};

let getPropertyPolicy = ( additionalPropToFetch ) => {
    let propertyPolicyOverride = {
        types: [ {
            name: 'Awb0Element',
            properties: [ {
                    name: 'awb0UnderlyingObject',
                    modifiers: [ excludeUiValues ]
                },
                {
                    name: 'object_string',
                    modifiers: [ {
                        name: 'uIValueOnly',
                        Value: 'true'
                    } ]
                },
                {
                    name: 'awb0Parent',
                    modifiers: [ {
                        name: 'withProperties',
                        Value: 'true'
                    } ]
                },
                {
                    name: 'awb0CopyStableId',
                    modifiers: [ excludeUiValues ]
                },
                {
                    name: 'awb0NumberOfChildren',
                    modifiers: [ excludeUiValues ]
                }
            ]
        } ]
    };
    if( Array.isArray( additionalPropToFetch ) ) {
        let additionalPropLength = additionalPropToFetch.length;
        for( let i = 0; i < additionalPropLength; i++ ) {
            propertyPolicyOverride.types[ 0 ].properties.push( { name: additionalPropToFetch[ i ] } );
        }
    }
    return propertyPolicyOverride;
};

/**
 * Use the 'productContext' of the 'active' context or 't_uid' as the 'productContext' to locate the object.
 *
 * @param {StringArray} csidsToBeSelected - UIDs that form a top-down path to the object to search for.
 *
 * @returns {Object} Response object from SOA 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement:getElementsForIds'
 */
export let doPerformSearchForProvidedCSIDChains = function( csidsToBeSelected, shouldFocusOnHiddenPackedElements, additionalPropToFetch ) {
    let deferred = AwPromiseService.instance.defer();
    let propertyPolicyOverride = getPropertyPolicy( additionalPropToFetch );
    return doPerformSearch( csidsToBeSelected, shouldFocusOnHiddenPackedElements, 'CSID_CHAIN', propertyPolicyOverride ).then( function( response ) {
        deferred.resolve( response );
        return deferred.promise;
    } );
};

/**
 * Use the 'productContext' of the 'active' context or 't_uid' as the 'productContext' to locate the object.
 *
 * @param {StringArray} sruidsToBeSelected - BOMLine UIDs of the object to search for.
 *
 * @returns {Object} Response object from SOA 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement:getElementsForIds'
 */
export let doPerformSearchForProvidedSRUIDs = function( sruidsToBeSelected, shouldFocusOnHiddenPackedElements, additionalPropToFetch ) {
    let deferred = AwPromiseService.instance.defer();
    let propertyPolicyOverride = getPropertyPolicy( additionalPropToFetch );
    return doPerformSearch( sruidsToBeSelected, shouldFocusOnHiddenPackedElements, 'SR_UID', propertyPolicyOverride ).then( function( response ) {
        deferred.resolve( response );
        return deferred.promise;
    } );
};

/**
 * Use the 'productContext' of the 'active' context or 't_uid' as the 'productContext' to locate the object.
 *
 * @param {StringArray} uidsToBeSelected - UIDs of the object to search for.
 *
 * @param {StringArray} typeOfUids - typeOfUids -> 'CSID_CHAIN' or 'SR_UID' of the object to search for.*
 *
 * @returns {Object} Response object from SOA 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement:getElementsForIds'
 */
let doPerformSearch = function( uidsToBeSelected, shouldFocusOnHiddenPackedElements, typeOfUids, propertyPolicyOverride ) {
    let context = appCtxService.getCtx( 'aceActiveContext.context' ); //$NON-NLS-1$

    // identify product context info
    let productContextInfo = context.productContextInfo;

    // identify if alternate configuation is present, then set useAlternateConfig
    let useAlternateConfig = 'false';
    if( context.productContextInfo.props && context.productContextInfo.props.awb0AlternateConfiguration ) {
        let alternatePCIUid = context.productContextInfo.props.awb0AlternateConfiguration.dbValues[ 0 ];
        if( !_.isNull( alternatePCIUid ) && !_.isUndefined( alternatePCIUid ) && !_.isEmpty( alternatePCIUid ) ) {
            useAlternateConfig = 'true';
        }
    }

    let addVisibleElement = 'false';
    if( !_.isUndefined( shouldFocusOnHiddenPackedElements ) ) {
        addVisibleElement = shouldFocusOnHiddenPackedElements;
    }

    // populate SOA input
    let elementsIn = {
        typeOfElementUids: typeOfUids,
        elementUids: uidsToBeSelected,
        productContext: productContextInfo,
        requestPref: {
            useAlternateConfig: [ useAlternateConfig ],
            addVisibleElement: [ addVisibleElement ]
        }
    };

    return soaService.postUnchecked( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getElementsForIds', { //$NON-NLS-1$
        elementsIn: elementsIn
    }, propertyPolicyOverride );
};

export default exports = {
    doPerformSearchForProvidedCSIDChains,
    doPerformSearchForProvidedSRUIDs
};
