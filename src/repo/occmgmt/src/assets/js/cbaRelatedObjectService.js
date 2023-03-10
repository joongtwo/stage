// Copyright (c) 2022 Siemens

/**
 * Service defines functionality to get related objects.
 * @module js/cbaRelatedObjectService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import soaService from 'soa/kernel/soaService';
import cbaConstants from 'js/cbaConstants';
import CBAImpactAnalysisService from 'js/CBAImpactAnalysisService';
import parsingUtils from 'js/parsingUtils';

let providerObjectTypeMapping = {
    Fnd0AlignedDesignsProvider: cbaConstants.FND_ALIGNED_DESIGN,
    Fnd0AlignedPartsProvider: cbaConstants.FND_ALIGNED_PART,
    Ebm0LinkedProductsProvider: cbaConstants.ITEM_REVISION
};

/**
 * Creates performSearchViewModel4 SOA Input object as per provider name
 * @param {Object} primaryObject - single selected object from primary work area
 * @param {String} providerName - Provider name as per type of object
 * @return {Object} - SOA Input Object
 */
let _getPerformSearchSOAInput = function( primaryObject, providerName ) {
    return {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: ''
        },
        searchInput: {
            maxToLoad: 100,
            maxToReturn: 100,
            providerName: providerName,
            searchCriteria: {
                parentUid: primaryObject.uid
            },
            startIndex: 0,
            searchSortCriteria: []
        }
    };
};

/**
 * Returns Aligned Parts/Designs model objects as per provider name
 * @param {Object} primaryObject - single selected object from primary work area
 * @param {String} providerName - Provider name as per type of object
 * @param {boolean} freshSOACallMode - True to get fresh data otherwise fetch the data from context
 * @return {ObjectArray} - Aligned Parts/Designs objects array
 */
export let getRelatedModelObjects = function( primaryObject, providerName, freshSOACallMode ) {
    let deferred = AwPromiseService.instance.defer();
    let makeSOACall = freshSOACallMode;

    if( !freshSOACallMode ) {
        let alignedObjects = appCtxSvc.getCtx( cbaConstants.CTX_PATH_LINKEDBOM_RELATEDMODELOBJECTS );

        makeSOACall = !alignedObjects;
        if( !makeSOACall ) {
            deferred.resolve( alignedObjects );
        }
    }
    if( makeSOACall ) {
        let modelObjectsArray = [];

        soaService.postUnchecked( 'Internal-AWS2-2019-06-Finder', 'performSearchViewModel4', _getPerformSearchSOAInput( primaryObject, providerName ) ).then( function( response ) {
            if( response.ServiceData ) {
                if( response.searchResultsJSON && response.ServiceData && response.ServiceData.modelObjects ) {
                    let searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
                    if( searchResults && searchResults.objects ) {
                        let searchedObjects = searchResults.objects;

                        if( CBAImpactAnalysisService.isImpactAnalysisMode() && searchedObjects.length > 0 ) {
                            searchedObjects = searchedObjects.slice( 0, 1 );
                        }
                        modelObjectsArray = searchedObjects.map( function( searchedObject ) {
                            return response.ServiceData.modelObjects[ searchedObject.uid ];
                        } );
                    }
                }
                deferred.resolve( modelObjectsArray );
            }
        } );
    }
    return deferred.promise;
};

const exports = {
    getRelatedModelObjects
};

export default exports;
