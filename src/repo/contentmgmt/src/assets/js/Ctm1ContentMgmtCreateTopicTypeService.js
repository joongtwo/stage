// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ctm1ContentMgmtCreateTopicTypeService
 */
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import contentMgmtSrv from 'js/Ctm1ContentMgmtService';
import localStrg from 'js/localStorage';
import eventBus from 'js/eventBus';

var exports = {};

var _savedLocal = null;

/**
 * This method is used for Add panels to find list of valid Topic Types that may be created under it.
 * Specificity this is used clear the ctx.ctm1 var so its ready to be populated anew.
 * @param {Object} ctx the context
 */
export let cleanupCtx = function( ctx ) {
    if( ctx.ctm1 ) {
        delete ctx.ctm1;
    }
};

/**
 * Is the active command AddChild or AddSibling.
 *
 * @param {Object} ctx the context
 * @returns {boolean} true if the active command is either AddChild or AddSibling.
 */
var isCommandAddChildOrSibling = function( ctx ) {
    return  ctx.activeToolsAndInfoCommand.commandId === 'Awb0AddChildElementDeclarative' ||
        ctx.activeToolsAndInfoCommand.commandId === 'Awb0AddSiblingElementDeclarative';
};

/**
 * Is the given Topic and its TopicType indicitive of a Publication Module object.
 *
 * @param {Object} topicObj the DC_Topic object
 * @param {Object} topicTypeObj the DC_Topic object's TopicType object
 * @returns {boolean} true if the object is thought to be a Publication Module object.
 */
var isTopicPubMod = function( topicObj, topicTypeObj ) {
    return topicObj.modelType.typeHierarchyArray.indexOf( 'DC_TopicRevision' ) > -1 && topicTypeObj.props.tagName.dbValues[ 0 ] === 'content';
};

/**
 * Is the given Topic and its TopicType indicitive of a PM Entry object.
 *
 * @param {Object} topicObj the DC_Topic object
 * @param {Object} topicTypeObj the DC_Topic object's TopicType object
 * @returns {boolean} true if the object is thought to be a PM Entry object.
 */
var isTopicPubModEntry = function( topicObj, topicTypeObj ) {
    return topicObj.modelType.typeHierarchyArray.indexOf( 'DC_TopicRevision' ) > -1 && topicTypeObj.props.tagName.dbValues[ 0 ] === 'pmEntry';
};

/**
 * This method is used to initialize the context in lieu of "cleanupCtx" above, when constructing
 * the create panel.
 *
 * @param {Object} ctx the context
 */
export let initializeContext = function( ctx ) {
    ctx.ctm1 = {};
    var selectedObject = contentMgmtSrv.getBomSelectedObj( ctx );
    if( selectedObject ) {
        var parentUnderlyingObject = null;

        if( selectedObject.props.awb0UnderlyingObject ) {
            if( ctx.activeToolsAndInfoCommand.commandId === 'Awb0AddChildElementDeclarative' ) {
                parentUnderlyingObject = contentMgmtSrv.getBomUnderlyingObj( selectedObject );
            } else if( ctx.activeToolsAndInfoCommand.commandId === 'Awb0AddSiblingElementDeclarative' ) {
                var parentObject = contentMgmtSrv.getBomParentObj( selectedObject );
                parentUnderlyingObject = contentMgmtSrv.getBomUnderlyingObj( parentObject );
            }
        }

        if( parentUnderlyingObject && parentUnderlyingObject.props.ctm0TopicTypeTagref ) {
            var parentTopicRef = cdm.getObject( parentUnderlyingObject.props.ctm0TopicTypeTagref.dbValues[ 0 ] );
            eventBus.publish( 'ctm1.getRelatedValidTopicTypes', {} );

            return { ctm1: { parentObject: parentUnderlyingObject, parentTopicType: parentTopicRef } };

            // Call the "ctm1.getTopicByParentTopicType" event - have to do this here because the context
            //  changes apparently are not immediately available to the condition evaluator when this function
            //  returns.
            // If we are adding a child or adding a sibling, send the event. May need additional criteria
            //  depending on the parent/child types or topics. Right now this function is only being called
            //  for DataModule so we only do this if adding the DM to PM Content or PM Entry.
            // if( isCommandAddChildOrSibling( ctx ) && ( isTopicPubMod( parentUnderlyingObject, parentTopicRef ) || isTopicPubModEntry( parentUnderlyingObject, parentTopicRef ) ) ) {
            //     eventBus.publish( 'ctm1.getTopicByParentTopicType', {} );
            // }
        }
        eventBus.publish( 'ctm1.getDefaultValidTopicTypes', {} );
        return { ctm1: { parentObject: null, parentTopicType: null } };
    }

    eventBus.publish( 'ctm1.getDefaultValidTopicTypes', {} );
    return { ctm1: { parentObject: null, parentTopicType: null } };
};

/**
 * This method is used for Add panels to find list of valid Topic Types that may be created under it.
 * Specificity this is used when there are no reference topic types to set the data structure to be empty.
 * @param {Object} ctx the ctx
 */
export let zeroReferenceTopicTypeRelations = function( ctx ) {
    ctx.ctm1.referenceTopicTypeRelations = {
        DC_TopicType: [],
        DC_RefTopicType: [],
        other: []
    };
};

/**
 * This method is used by getTopicTypeLov and waits to resolve a promise until variables are filled.
 * It does have a limit on how long it will wait before resolving.
 * @param {Object} ctx the ctx
 * @param {Object} deferred the promise
 * @param {int} count of how many times it checked
 */
var checkIfExpandIsDone = function( ctx, deferred, count ) {
    if( ++count > 15 ) {
        deferred.resolve();
    } else if( ctx.activeToolsAndInfoCommand.commandId !== 'Awb0AddChildElementDeclarative' &&
        ctx.activeToolsAndInfoCommand.commandId !== 'Awb0AddSiblingElementDeclarative' &&
        ctx.ctm1 && ctx.ctm1.validTopicTypes ) {
        deferred.resolve();
    } else if( ctx.ctm1 && ctx.ctm1.referenceTopicTypeRelations ) {
        deferred.resolve();
    } else {
        setTimeout( function() {
            checkIfExpandIsDone( ctx, deferred, count );
        }, 500 );
    }
};

/**
 * This method is used for Add panels to find list of valid Topic Types that may be created under it.
 * Specificity this is used to populate the "Topic Type" drop down widget.
 * @param {Object} ctx the ctx
 * @param {Object} filter the filter string.
 * @param {Object} allowMultiVersions the flag for allowing multi topic type versions.
 * @returns {Array} the LOV return values
 */
export let getTopicTypeLov = function( ctx, filter, allowMultiVersions ='false' ) {
    var deferred = AwPromiseService.instance.defer();

    var promise = AwPromiseService.instance.when( deferred.promise ).then( function() {
        var lov = [];

        if( ctx.activeToolsAndInfoCommand.commandId !== 'Awb0AddChildElementDeclarative' &&
            ctx.activeToolsAndInfoCommand.commandId !== 'Awb0AddSiblingElementDeclarative' ) {
            lov = filterLovValues( ctx.ctm1.validTopicTypes, filter );
            return lov;
        }

        if( ctx.ctm1.parentTopicTypeRelations ) {
            // Search all direct relations and add matches to lov
            for( let x = 0; x < ctx.ctm1.parentTopicTypeRelations.DC_TopicType.length; ++x ) {
                let obj = ctx.ctm1.parentTopicTypeRelations.DC_TopicType[ x ];
                for( let y = 0; y < ctx.ctm1.validTopicTypes.length; ++y ) {
                    if( obj.uid === ctx.ctm1.validTopicTypes[ y ].propInternalValue ) {
                        if ( allowMultiVersions === 'true' ) {
                            if ( obj.props.tagName ) {
                                let tagName = obj.props.tagName.dbValues[0];
                                let typesWithSameTag = getTopicTypesWithTagName( ctx.ctm1.validTopicTypes, tagName );
                                lov = lov.concat( typesWithSameTag );
                            } else if ( lov.length < ctx.ctm1.validTopicTypes.length ) {
                                lov = lov.concat( ctx.ctm1.validTopicTypes );
                            }
                        } else {
                            lov.push( ctx.ctm1.validTopicTypes[ y ] );
                        }
                        break;
                    }
                }
            }
        } else {
            lov = filterLovValues( ctx.ctm1.validTopicTypes, filter );
            return lov;
        }

        if( ctx.ctm1.referenceTopicTypeRelations ) {
            // Search all reference relations and add matches to lov
            for( let x = 0; x < ctx.ctm1.referenceTopicTypeRelations.DC_TopicType.length; ++x ) {
                let obj = ctx.ctm1.referenceTopicTypeRelations.DC_TopicType[ x ];
                for( let y = 0; y < ctx.ctm1.validTopicTypes.length; ++y ) {
                    if( obj.uid === ctx.ctm1.validTopicTypes[ y ].propInternalValue ) {
                        if ( allowMultiVersions === 'true' ) {
                            if ( obj.props.tagName ) {
                                let tagName = obj.props.tagName.dbValues[0];
                                let typesWithSameTag = getTopicTypesWithTagName( ctx.ctm1.validTopicTypes, tagName );
                                lov = lov.concat( typesWithSameTag );
                            } else if ( lov.length < ctx.ctm1.validTopicTypes.length ) {
                                lov = lov.concat( ctx.ctm1.validTopicTypes );
                            }
                        } else {
                            lov.push( ctx.ctm1.validTopicTypes[ y ] );
                        }
                        break;
                    }
                }
            }
        }


        // Return unique lov
        lov = filterLovValues( lov, filter );
        return Array.from( new Set( lov ) ).sort( function( a, b ) {
            if( a.propDisplayValue < b.propDisplayValue ) {
                return -1;
            } else if( a.propDisplayValue > b.propDisplayValue ) {
                return 1;
            }
            return 0;
        } );
    } );

    checkIfExpandIsDone( ctx, deferred, 0 );

    return promise;
};

/**
 * Filter LOV value using filter
 * @param {object} values value list
 * @param {object} filter filter string
 * @returns filtered values.
 */
let filterLovValues = function( values, filter ) {
    if( filter ) {
        let lovValues = values.filter( function ( lov ) { return lov.propDisplayValue.toLowerCase().includes(filter.toLowerCase()); });
        return lovValues;
    } else {
        return values;
    }
};

/**
 * This method is used for Add panels to find list of valid Topic Types that may be created under it.
 * Specificity this sorts topic types based on whether its a reference or not.
 * @param {Object} response the SOA response from GRM expand
 * @returns {Object} the sorted topic types
 */
export let sortTopicTypeRelations = function( response ) {
    var DC_TopicType = [];
    var DC_RefTopicType = [];
    var other = [];

    if( response.output ) {
        for( var x = 0; x < response.output.length; ++x ) {
            for( var y = 0; y < response.output[ x ].relationshipData.length; ++y ) {
                for( var z = 0; z < response.output[ x ].relationshipData[ y ].relationshipObjects.length; ++z ) {
                    var obj = response.output[ x ].relationshipData[ y ].relationshipObjects[ z ];

                    if( obj.otherSideObject.modelType.typeHierarchyArray.indexOf( 'DC_RefTopicType' ) >= 0 ) {
                        if( obj.otherSideObject.props.referenceType.dbValues[ 0 ] === 'COMPOSABLE_TOPIC_REFERENCE' ) {
                            DC_RefTopicType.push( obj.otherSideObject );
                        } else {
                            other.push( obj.otherSideObject );
                        }
                    } else if( obj.otherSideObject.modelType.typeHierarchyArray.indexOf( 'DC_TopicType' ) >= 0 ) {
                        DC_TopicType.push( obj.otherSideObject );
                    } else {
                        other.push( obj.otherSideObject );
                    }
                }
            }
        }
    }

    return {
        DC_TopicType: Array.from( new Set( DC_TopicType ) ),
        DC_RefTopicType: Array.from( new Set( DC_RefTopicType ) ),
        other: Array.from( new Set( other ) )
    };
};

/**
 * This method is used to filter out DC_RefTopicType types.
 * @param {Object} response the response of the soa
 * @returns {Array} the LOV return values
 */
export let filterReferenceTopicTypes = function( response ) {
    var lov = contentMgmtSrv.getLovFromQuery( response );

    var rArray = [];

    // Find all "DC_TopicType" type
    for( var z = 0; z < lov.length; ++z ) {
        if( lov[ z ].propInternalType !== 'DC_RefTopicType' ) {
            rArray.push( lov[ z ] );
        }
    }

    return rArray;
};

/**
 * This method is used to get Topic Type LOV from SOA response.
 * @param {Object} response the response of the soa
 * @returns {Array} the LOV return values
 */
export let getTopicTypeLovFromResponse = function( response ) {
    var lov = [];
    if( response.topicTypes ) {
        response.topicTypes.forEach( function( obj ) {
            var modelObject = cdm.getObject( obj.uid );
            lov.push( {
                propDisplayValue: modelObject.props.object_string.uiValues[ 0 ],
                propInternalValue: modelObject.uid,
                propInternalType: modelObject.type
            } );
        } );
    }

    return lov;
};

/**
 * Queries that use object_name need to be in the en_US local to work correctly.
 */
export let resetLocal = function() {
    var awSession = localStrg.get( 'awSession' );

    if( awSession ) {
        try {
            awSession = JSON.parse( awSession );
            if( awSession.locale && awSession.locale !== 'en_US' ) {
                _savedLocal = awSession.locale;
                awSession.locale = 'en_US';
                awSession = JSON.stringify( awSession );
                localStrg.publish( 'awSession', awSession );
            }
        } catch ( err ) {
            //
        }
    }
};

/**
 * Restore the local back to what it was originally
 */
export let restoreLocal = function() {
    var awSession = localStrg.get( 'awSession' );

    if( awSession && _savedLocal ) {
        try {
            awSession = JSON.parse( awSession );
            if( awSession.locale ) {
                awSession.locale = _savedLocal;
                awSession = JSON.stringify( awSession );
                localStrg.publish( 'awSession', awSession );
            }
        } catch ( err ) {
            //
        }
    }
};

/**
 * This method is used to get the topic classes from soa response.
 * @param {Object} response the response of the soa
 * @returns {Array} topic class names.
 */
export let getClassNamesWithValidTopicType = function( response ) {
    var classNames = [];

    if( response.result ) {
        response.result.forEach( function( obj ) {
            var modelObject = cdm.getObject( obj.uid );
            if( modelObject.props.applyClassName && classNames.indexOf( modelObject.props.applyClassName.dbValues[ 0 ] ) === -1 ) {
                classNames.push( modelObject.props.applyClassName.dbValues[ 0 ] );
            }
        } );
    }

    return classNames;
};

/**
 * Get all content business object types with a valid topic type.
 * @param {object} response - SOA response
 * @param {object} data - The panel's view model object
 * @returns {object} the type list
 */
export let getCtmObjectTypesWithTopicType = function( response, data ) {
    var objectTypeList = [];

    if( response.searchResults ) {
        response.searchResults.forEach( function( result ) {
            if( result ) {
                var statusObject = cdm.getObject( result.uid );
                if ( data.ctmBOsWithTopicType && data.ctmBOsWithTopicType.indexOf( statusObject.props.type_name.dbValues[ 0 ] ) !== -1 ) {
                    objectTypeList.push( result );
                }
            }
        } );
    }
    // Sort the task template object list by default with dispaly name
    // objectTypeList = _.sortBy( objectTypeList, 'propDisplayValue' );
    return objectTypeList;
};

/**
 * When user select type from type selection panel of content, we need to navigate to create form.
 * @param {Object} data - The panel's view model object
 */
export let handleTypeSelectionJs = function( data ) {
    var selectedType = data.dataProviders.getCreatableContentTypes.selectedObjects;
    if ( selectedType && selectedType.length > 0 ) {
        return { creationType: selectedType[0], selectedType: { dbValue: selectedType[0].props.type_name.dbValue } };
    }

    return { creationType: null, selectedType: '' };
};

/**
 * Clear selected type when user click on back button on create form
 * @param {Object} data - The create change panel's view model object
 */
export let clearSelectedType = function( data ) {
    data.selectedType.dbValue = '';
    data.creationType = null;
    return {
        selectedType: data.selectedType,
        creationType: data.creationType
    };
};

/**
 * get parent topic type from soa response.
 * @param {object} response soa response
 * @returns {object} first model object in result
 */
export let getParentTopicType = function( response ) {
    var firstSearchResult = contentMgmtSrv.getFirstResult( response );

    if( firstSearchResult && !firstSearchResult.props.object_string ) {
        firstSearchResult = cdm.getObject( firstSearchResult.uid );
    }

    return firstSearchResult;
};


/**
 * This method is used for Add panels to find list of valid Topic Types that may be created under it.
 * Specificity this returns the search input for query find topics based on parent topic type.
 * @param {Object} ctx the ctx
 * @param {Object} data the data
 * @returns {Object} the search input
 */
export let getParentTopicTypeSearchInput = function( ctx, data ) {
    var searchInput = {
        maxToLoad: 250,
        maxToReturn: 250,
        providerName: 'Awp0SavedQuerySearchProvider',
        searchCriteria: {
            queryName: '__ctm0_Topic_Type_Query',
            searchID: 'TOPIC_TYPE_QUERY',
            typeOfSearch: 'ADVANCED_SEARCH',
            utcOffset: '0',
            lastEndIndex: '0',
            object_name: 'none',
            startIndex: data.dataProviders.listProvider.startIndex
        },
        searchSortCriteria: [ {
            fieldName: 'object_name',
            sortDirection: 'ASC'
        } ]
    };

    var selectedObject = contentMgmtSrv.getBomSelectedObj( ctx );
    var parentUnderlyingObject = null;

    if( selectedObject.props.awb0UnderlyingObject ) {
        if( ctx.activeToolsAndInfoCommand.commandId === 'Awb0AddChildElementDeclarative' ) {
            parentUnderlyingObject = contentMgmtSrv.getBomUnderlyingObj( selectedObject );
        } else if( ctx.activeToolsAndInfoCommand.commandId === 'Awb0AddSiblingElementDeclarative' ) {
            var parentObject = contentMgmtSrv.getBomParentObj( selectedObject );
            parentUnderlyingObject = contentMgmtSrv.getBomUnderlyingObj( parentObject );
        }
    }

    if( parentUnderlyingObject ) {
        exports.resetLocal();
        var uiValue = parentUnderlyingObject.props.ctm0TopicTypeTagref.uiValues[ 0 ];
        if( uiValue === null || uiValue === '' ) {
            var topicType = cdm.getObject( parentUnderlyingObject.props.ctm0TopicTypeTagref.dbValues[ 0 ] );
            uiValue = topicType.props.object_name ? topicType.props.object_name.uiValues[ 0 ] : topicType.props.object_string.uiValues[ 0 ];
        }
        searchInput.searchCriteria.object_name = uiValue;
    }

    return searchInput;
};

/**
 * Get Topic Types Search input based on apply class name.
 * @param {String} applyClass apply class name
 * @returns search input
 */
export let getValidTopicTypesSearchInput = function( applyClass ) {
    var searchInput = {
        maxToLoad: 250,
        maxToReturn: 250,
        providerName: 'Awp0SavedQuerySearchProvider',
        searchCriteria: {
            queryName: '__ctm0_Topic_Type_Query',
            searchID: 'TOPIC_TYPE_QUERY',
            typeOfSearch: 'ADVANCED_SEARCH',
            utcOffset: '0',
            lastEndIndex: '0',
            applyClassName: '*',
            startIndex: '0'
        },
        searchSortCriteria: [ {
            fieldName: 'object_name',
            sortDirection: 'ASC'
        } ]
    };

    if( applyClass ) {
        searchInput.searchCriteria.applyClassName = applyClass;
    }

    return searchInput;
};


/**
 * Get the topic type object of the parent BOMline underlying object.
 * @param {Object} ctx context object.
 * @returns topic type.
 */
export let getParentBOMLineTopicType = function( ctx ) {
    var selectedObject = contentMgmtSrv.getBomSelectedObj( ctx );
    var parentUnderlyingObject = null;

    if( selectedObject.props.awb0UnderlyingObject ) {
        if( ctx.activeToolsAndInfoCommand.commandId === 'Awb0AddChildElementDeclarative' ) {
            parentUnderlyingObject = contentMgmtSrv.getBomUnderlyingObj( selectedObject );
        } else if( ctx.activeToolsAndInfoCommand.commandId === 'Awb0AddSiblingElementDeclarative' ) {
            var parentObject = contentMgmtSrv.getBomParentObj( selectedObject );
            parentUnderlyingObject = contentMgmtSrv.getBomUnderlyingObj( parentObject );
        }
    }

    if( parentUnderlyingObject && parentUnderlyingObject.props.ctm0TopicTypeTagref ) {
        return cdm.getObject( parentUnderlyingObject.props.ctm0TopicTypeTagref.dbValues[0] );
    }

    return null;
};

/**
 * Get Brex data module list.
 * @param {Object} ctx the context
 * @returns an array of brex data modules.
 */
export let getBrexDMList = function( ctx ) {
    var brexList = [];

    if ( ctx.ctm1.brexDMList ) {
        brexList =  ctx.ctm1.brexDMList;
    }

    return brexList;
};

/**
 * Get topic type SOA input for getting brex data modules
 * @param {Object} data the view model data.
 * @returns topic type.
 */
export let getSOAInputForBrexDM = function( data ) {
    return data.topicTypeRef;
};


/**
 * Get topic revisions with brex data module topic type from response.
 * @param {Object} response soa response
 * @param {Object} data the view model
 * @returns topic revisions with brex data module topic type.
 */
export let getTopicRevisionsFromResponse = function( response, data ) {
    var lov = [];
    if( response.topicRevisions ) {
        response.topicRevisions.forEach( function( obj ) {
            var modelObject = cdm.getObject( obj.uid );
            lov.push( {
                propDisplayValue: modelObject.props.item_id.uiValues[ 0 ],
                propInternalValue: modelObject.uid,
                propInternalType: modelObject.type
            } );
        } );
    }

    return lov;
};

/**
 *
 * @param {Object} data view model object
 * @returns parent object for brex data moduel reference.
 */
export let getParentElement = function( data ) {
    if( Array.isArray( data.createdObject ) && data.createdObject.length > 0 ) {
        return data.createdObject[0];
    }

    // check if created a new object ? if yes, create an array, insert this newly created element in it and return
    if( data.createdObject ) {
        return data.createdObject;
    }

    // add content dialog has createdContentRevision.
    if ( data.createdContentRevision ) {
        return data.createdContentRevision;
    }
};

/**
 * Get topic type reference from select change event.
 * @param {object} eventData event data
 * @returns topic type reference object.
 */
export let getTopicTypeRef = function( eventData ) {
    let topicTypeRef = null;
    if( eventData.ctm0TopicTypeTagref ) {
        topicTypeRef =  cdm.getObject( eventData.ctm0TopicTypeTagref.dbValue);
    }

    return topicTypeRef;
};

/**
 * Get Brex DM selection.
 * @param {Object} ctx the context object.
 * @returns brex dm object.
 */
export let getBrexDM = function( ctx ) {
    var brexDMs = [];
    brexDMs.push( ctx.ctm1brexDM );
    return brexDMs;
};

/**
 * Cache brex data module selection.
 * @param {Object} ctx the context object.
 */
export let cacheBrexDMSelection = function( ctx, data ) {
    ctx.ctm1brexDM = {};
    if ( data.rrr__brex && data.rrr__brex.dbValue.length > 0 ) {
        var dm = cdm.getObject( data.rrr__brex.dbValue );
        ctx.ctm1brexDM = {
            uid: dm.uid,
            type: dm.type
        };
    }
};

/**
 * Filter topic type LOV by given tag name.
 * @param {Object} topicTypeList topic type lov
 * @param {Object} tagName tag name
 * @returns array of topic types with the same tag name.
 */
let getTopicTypesWithTagName = function( topicTypeList, tagName ) {
    let topicTypes = [];
    topicTypeList.forEach( function( x ) {
        var topicType = cdm.getObject( x.propInternalValue );
        if ( topicType.props.tagName && topicType.props.tagName.dbValues[0] === tagName ) {
            topicTypes.push( x );
        }
    } );

    return topicTypes;
};

/**
 * Ctm1ContentMgmtCreateTopicTypeService factory
 */
export default exports = {
    cleanupCtx,
    initializeContext,
    zeroReferenceTopicTypeRelations,
    getTopicTypeLov,
    getTopicTypeLovFromResponse,
    sortTopicTypeRelations,
    filterReferenceTopicTypes,
    resetLocal,
    restoreLocal,
    getClassNamesWithValidTopicType,
    getCtmObjectTypesWithTopicType,
    handleTypeSelectionJs,
    clearSelectedType,
    getParentTopicType,
    getParentBOMLineTopicType,
    getBrexDMList,
    getSOAInputForBrexDM,
    getTopicRevisionsFromResponse,
    getParentElement,
    getBrexDM,
    getTopicTypeRef,
    cacheBrexDMSelection,
    getValidTopicTypesSearchInput,
    getParentTopicTypeSearchInput
};
