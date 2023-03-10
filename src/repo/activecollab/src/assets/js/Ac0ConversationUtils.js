// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ac0ConversationUtils
 */
import appCtxSvc from 'js/appCtxService';
import browserUtils from 'js/browserUtils';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import fmsUtils from 'js/fmsUtils';
import uwPropSvc from 'js/uwPropertyService';
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';
import soa from 'soa/kernel/soaService';
import AwTimeoutService from 'js/awTimeoutService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import AwStateService from 'js/awStateService';
import advancedSearchUtils from 'js/advancedSearchUtils';
import localeService from 'js/localeService';

var exports = {};

var LESS_CHARACTER_LIMIT = 131;

const CONVCTX_SELECTED = 'Ac0ConvCtx.selected';

var stripHtmlTagsFromRichText = function( richTextToClean ) {
    var htmlTagsRegex = /<(?!\/?figure|img(?=>|\s.*>))\/?.*?>/g;
    var removeOpenSpanTags = /<span[^/>]*>*/g;
    return richTextToClean.replace( htmlTagsRegex, '' ).replace( removeOpenSpanTags, '' );
};

export let processRichText = function( richText ) {
    var curtailedRichTextObj = {};
    curtailedRichTextObj.curtailRichText = '';
    curtailedRichTextObj.showMore = false;

    var strippedRichText = stripHtmlTagsFromRichText( richText );
    if( strippedRichText.length < LESS_CHARACTER_LIMIT ) {
        curtailedRichTextObj.curtailRichText = richText;
        return curtailedRichTextObj;
    }

    curtailedRichTextObj.showMore = true;

    //restricting richText length to LESS_CHARACTER_LIMIT
    var charLimitRichText = richText.substring( 0, LESS_CHARACTER_LIMIT + 1 );
    var strippedCharLimitRichText = stripHtmlTagsFromRichText( charLimitRichText );
    var removedLen = 0;

    while( strippedCharLimitRichText.length < LESS_CHARACTER_LIMIT ) {
        removedLen += LESS_CHARACTER_LIMIT - strippedCharLimitRichText.length;
        var updatedStrippedCharLimitRichText = richText.substring( 0, removedLen + LESS_CHARACTER_LIMIT );
        strippedCharLimitRichText = stripHtmlTagsFromRichText( updatedStrippedCharLimitRichText );
    }

    charLimitRichText = richText.substring( 0, LESS_CHARACTER_LIMIT + removedLen );

    //edge case of mangled html due to cutting off text
    if( /<\w*$/.test( charLimitRichText ) || /<\/\w*$/.test( charLimitRichText ) ) {
        charLimitRichText = charLimitRichText.substring( 0, charLimitRichText.lastIndexOf( '<' ) );
    }

    //if text contains special html tags, split at where it begins
    charLimitRichText = charLimitRichText.split( /(?:<ul>)|(?:<ol>)|(?:<img)/ )[ 0 ];

    //check for open tags
    var openTags = [];
    var closeTags = [];
    var appendedTags = '';

    var openTagIt = charLimitRichText.matchAll( /<[^>/]*>/g );
    var closeTagIt = charLimitRichText.matchAll( /<\/[^>]+>/g );

    for( var ot of openTagIt ) {
        openTags.push( ot[ 0 ].substring( ot[ 0 ].indexOf( '<' ) + 1, ot[ 0 ].indexOf( '>' ) ) );
    }

    for( var ct of closeTagIt ) {
        closeTags.push( ct[ 0 ].substring( ct[ 0 ].indexOf( '/' ) + 1, ct[ 0 ].indexOf( '>' ) ) );
    }

    if( openTags.length > 0 && closeTags.length > 0 ) {
        for( var ii = 0; ii < closeTags.length; ii++ ) {
            for( var jj = 0; jj < openTags.length; jj++ ) {
                if( closeTags[ ii ] === openTags[ jj ] ) {
                    openTags[ jj ] = null;
                    break;
                }
            }
        }
        for( var kk = openTags.length - 1; kk >= 0; kk-- ) {
            if( openTags[kk] !== null ) {
                appendedTags += '</' + openTags[kk] + '>';
            }
        }
    }
    curtailedRichTextObj.curtailRichText = charLimitRichText.trim() + ' ...' + appendedTags;

    return curtailedRichTextObj;
};

export let processPlainText = function( plainText ) {
    var curtailedPlainTextObj = {};
    curtailedPlainTextObj.curtailPlainText = '';
    curtailedPlainTextObj.showMore = false;

    if( plainText.length < LESS_CHARACTER_LIMIT ) {
        curtailedPlainTextObj.curtailPlainText = plainText;
        curtailedPlainTextObj.showMore = false;
        return curtailedPlainTextObj;
    }

    curtailedPlainTextObj.showMore = true;
    var charLimitPlainText = plainText.substring( 0, LESS_CHARACTER_LIMIT + 1 );
    curtailedPlainTextObj.curtailPlainText = charLimitPlainText + ' ...';
    return curtailedPlainTextObj;
};

/**
 * getObjectUID - returns the object UID
 * @param {Object} object object whose uid is required
 * @returns {String} uid
 */
export let getObjectUID = function( object ) {
    var uid;

    if( object && object.uid ) {
        uid = object.uid;

        if( object.props && object.props.awb0UnderlyingObject ) {
            uid = object.props.awb0UnderlyingObject.dbValues[0];
        }
    }

    return uid;
};

/**
 * getObjectUID - returns the object UID
 * @param {Object} object object whose uid is required
 * @returns {String} uid
 */
export let getObjectUIDOnOpenPanel = function( object, ctx, data ) {
    var deferred = AwPromiseService.instance.defer();
    var uid;

    var convCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' );
    if( typeof convCtx !== 'undefined' && typeof convCtx.selected !== 'undefined' &&  convCtx.selected.type === 'Fnd0Snapshot' ) {
        uid = convCtx.selected.uid;
    }

    if( typeof convCtx !== 'undefined' && typeof convCtx.currentSelectedSnapshot !== 'undefined' ) {
        uid = convCtx.currentSelectedSnapshot.uid;
        return uid;
    }

    if( !object && ctx.state && ctx.state.processed ) {
        uid = ctx.state.processed.uid;
        //
        dmSvc.loadObjects( [ uid ] ).then( function( ) {
            var tmpObj = cdm.getObject( uid );
            tmpObj.cellHeader1 = tmpObj.props.object_string.uiValues[0];
            convCtx.selected = tmpObj;
            ctx.selected = tmpObj;
            data.selectedObject.dbValue = tmpObj.props.object_name.uiValues[0];
            data.selectedObject.uiValue = tmpObj.props.object_name.uiValues[0];
            data.selectedObject.dispValue = tmpObj.props.object_name.uiValues[0];
            if ( ctx.aw_hosting_enabled && data.selectedHostedObject ) {
                data.selectedHostedObject.dbValue = tmpObj.props.object_string.dbValues[0];
                data.selectedHostedObject.dispValue = tmpObj.props.object_string.uiValues[0];
                data.selectedHostedObject.uiValue = tmpObj.props.object_string.uiValues[0];
            }
            appCtxSvc.updateCtx( 'selected', tmpObj );
            appCtxSvc.updateCtx( CONVCTX_SELECTED, tmpObj );
            deferred.resolve( {} );
        } );
    }

    if( object && object.uid ) {
        uid = object.uid;

        if( object.props && object.props.awb0UnderlyingObject ) {
            uid = object.props.awb0UnderlyingObject.dbValues[0];
        }
    }

    return uid;
};


/**
 * getObjectUID - returns the object UID
 * @param {Object} object object whose uid is required
 * @returns {String} uid
 */
export let getSearchMode = function( ) {
    var searchMode;

    var convCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' );

    if( typeof convCtx !== 'undefined' && typeof convCtx.selected !== 'undefined' && convCtx.selected.type === 'Fnd0Snapshot' ) {
        return 'relatedConversationForObject';
    }

    if( typeof convCtx !== 'undefined' && typeof convCtx.currentSelectedSnapshot !== 'undefined' ) {
        searchMode = 'relatedConversationForObject';
    } else{
        searchMode = 'conversationsForSourceObject';
    }

    return searchMode;
};

/**
 * Return the cursor end index value
 * @param {Object} conversationDataProvider ConversationDataProvider
 * @returns {Integer} end index value
 */
export let getCursorEndIndexValue = function( conversationDataProvider ) {
    var cursorObjectVar = conversationDataProvider.cursorObject;
    if( typeof cursorObjectVar !== 'undefined' && cursorObjectVar !== null ) {
        var startValue = cursorObjectVar.startIndex;
        var endValue = cursorObjectVar.endIndex;
        if( typeof endValue !== 'undefined' && endValue !== null ) {
            if( typeof startValue !== 'undefined' && startValue !== null && startValue > endValue ) {
                return startValue;
            }
            return endValue;
        }
    }
    return 0;
};

/**
 * Return the cursor end reached value
 * @param {Object} conversationDataProvider ConversationDataProvider
 * @returns {Boolean} end reached value
 */
export let getCursorEndReachedValue = function( conversationDataProvider ) {
    var cursorObjectVar = conversationDataProvider.cursorObject;
    if( typeof cursorObjectVar !== 'undefined' && cursorObjectVar !== null ) {
        var endReachedValue = cursorObjectVar.endReached;
        if( typeof endReachedValue !== 'undefined' && endReachedValue !== null ) {
            return endReachedValue;
        }
    }
    return false;
};

/**
 * Return the cursor start reached value
 * @param {Object} conversationDataProvider ConversationDataProvider
 * @returns {Boolean} start reached value
 */
export let getCursorStartReachedValue = function( conversationDataProvider ) {
    var cursorObjectVar = conversationDataProvider.cursorObject;
    if( typeof cursorObjectVar !== 'undefined' && cursorObjectVar !== null ) {
        var startReachedValue = cursorObjectVar.startReached;
        if( typeof startReachedValue !== 'undefined' && startReachedValue !== null ) {
            return startReachedValue;
        }
    }
    return false;
};

/**
 * @param {Array} vmos selected vmos to be deleted
 * @param {Object} dataprovider dataprovider that contains list that needs to be updated
 */
export let removeObjectsFromDPCollection = function( vmos, dataprovider ) {
    if( typeof dataprovider !== 'undefined' ) {
        var allLoadedObjects = dataprovider.viewModelCollection.getLoadedViewModelObjects();
        //var loadedObjectsAfterRemove = _.difference( allLoadedObjects, vmos );
        var removedObjs = _.remove( allLoadedObjects, function( obj ) {
            return vmos[0].uid === obj.uid;
        } );
        dataprovider.update( allLoadedObjects, allLoadedObjects.length );
    }
};

/**
 * getObjectUID - returns the object UID
 * @param {Object} subPanelCtx sub panel context
 * @returns {String} uid
 */
export let getConvObjectUID = function( subPanelCtx,  ctx ) {
    if( isDiscussionSublocation() ) {
        return ctx.selected.uid;
    }
    return subPanelCtx.uid;
};

export let initCommentsPanel = function( vmData, discussionData ) {
    var deferred = AwPromiseService.instance.defer();
    const newDiscussionData = { ...discussionData.getValue() };
    newDiscussionData.commentsDataProvider = vmData.dataProviders.commentsDataProvider;
    discussionData.update( newDiscussionData );
    //     no comments available to load or available comments can be fetched in 1 load. No paging required, proceed naturally

    deferred.resolve( {} );
    return deferred.promise;
};

/**
 * setSelectedObjectInContext - returns the object name value
 * @param {Object} data object whose uid is required
 */
export let setSelectedObjectInContext = function( data ) {
    var selObj = appCtxSvc.getCtx( 'selected' );
    // We need to handle the use case where the 'panel' was opened in the
    // 'hosted' location used by NX.  In this case there is not a 'selected'
    // object in the context as there is no selected object in the UI
    // The selected object is in the URL, we are populating this in the
    // subPanelContext in this case.
    if( typeof selObj === 'undefined' && typeof data !== 'undefined' && data !== null ) {
        if( typeof data.subPanelContext !== 'undefined' && data.subPanelContext !== null
                && typeof data.subPanelContext.selectionData !== 'undefined' ) {
            selObj = data.subPanelContext.selectionData.selected[0];
        } else {
            const stateParams = AwStateService.instance.params;
            const objectUid = stateParams.uid;
            selObj = cdm.getObject( objectUid );
        }
    }
    if( selObj ) {
        if( selObj.props && selObj.props.awb0UnderlyingObject ) {
            var underlyingUid = selObj.props.awb0UnderlyingObject.dbValues[0];
            var underlyingObj = cdm.getObject( underlyingUid );
            appCtxSvc.updateCtx( CONVCTX_SELECTED, underlyingObj );
        } else {
            appCtxSvc.updateCtx( CONVCTX_SELECTED, selObj );
        }
    }
};

/**
 * setObjectDisplayData - returns the object name value
 * @param {Object} data object whose uid is required
 */
export let setObjectDisplayData = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var selObj = appCtxSvc.getCtx( 'selected' );
    if( selObj ) {
        if( selObj.props &&
            selObj.props.awb0UnderlyingObject && appCtxSvc.getCtx( CONVCTX_SELECTED ) ) {
            var underlyingUid = selObj.props.awb0UnderlyingObject.dbValues[0];
            dmSvc.getProperties( [ underlyingUid ], [ 'object_name' ] ).then( function( response ) {
                var underlyingObj = cdm.getObject( underlyingUid );
                var dbStringValue = underlyingObj.props.object_name.dbValues[0];
                var uiStringValue = underlyingObj.props.object_name.uiValues[0];
                underlyingObj.props.object_name.dbValue = dbStringValue;
                underlyingObj.props.object_name.uiValue = uiStringValue;
                appCtxSvc.updateCtx( CONVCTX_SELECTED, underlyingObj );
                uwPropSvc.setValue( data.selectedObject, uiStringValue );
                deferred.resolve( {} );
            } );
        } else {
            appCtxSvc.updateCtx( CONVCTX_SELECTED, selObj );
            deferred.resolve( {} );
        }
    }
    return deferred.promise;
};

export let saveDeleteConvItemInContext = function( subPanelContext ) {
    var convCtx = getAc0ConvCtx();
    convCtx.deleteConvObj = [ subPanelContext.data ];
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
};

/**
 * Return FMS base url
 * @returns {String} url
 */
export let getFmsBaseURL = function() {
    return browserUtils.getBaseURL() + fmsUtils.getFMSUrl();
};

/**
 * Get file URL from ticket.
 *
 * @param {String} ticket - File ticket.
 * @return file URL
 */
// TODO move this into a shared util class
var getFileTickerURL = function( ticket ) {
    if ( ticket ) {
        return browserUtils.getBaseURL() +  ticket;
    }
    return null;
};

/**
 * Utility method that will call a method inside the AC soa list with appropriate serviceInput
 * @param {*} method SOA method
 * @param {*} serviceInput service input for SOA
 * @returns {*} Promise
 */
export let callActiveCollabSoa = function( method, serviceInput ) {
    var deferred = AwPromiseService.instance.defer();
    soa.postUnchecked( 'ActiveCollaboration-2020-12-ActiveCollaboration', method, serviceInput ).then(
        function( responseData ) {
            deferred.resolve( responseData );
        } );

    return deferred.promise;
};

export let confirmDeleteConv = function() {
    var deferred = AwPromiseService.instance.defer();
    var objsToDelete = appCtxSvc.getCtx( 'Ac0ConvCtx' ).deleteConvObj;
    var convDp = appCtxSvc.getCtx( 'Ac0ConvCtx' ).convDP;
    var delSoaInput = {};
    delSoaInput.objsToDelete = objsToDelete;//ctx.Ac0ConvCtx.deleteConvObj
    exports.callActiveCollabSoa( 'deleteConversation', delSoaInput ).then( function( respData ) {
        exports.removeObjectsFromDPCollection( objsToDelete, convDp  );
        deferred.resolve( {} );
    } );

    return deferred.promise;
};

let stripINTERNALfromValues = function( originalValues ) {
    var stripValues = '';
    var tmpArray = originalValues.split( ';' );
    for( var i = 0; i < tmpArray.length; i++ ) {
        var tmpValue = tmpArray[i];
        var indexOfInternal = tmpValue.indexOf( '__I_N_T_E_R_N_A_L__' );
        var tmpValueSubStr = tmpValue.substring( 0, indexOfInternal );
        stripValues +=  tmpValueSubStr;
        if( i < tmpArray.length - 1 ) {
            stripValues += ',';
        }
    }
    return stripValues;
};

let populateFilterParametersFromState = function( tmpValue ) {
    if( typeof tmpValue !== 'undefined' ) {
        if ( tmpValue.indexOf( '__I_N_T_E_R_N_A_L__' ) > 0 ) {
            return stripINTERNALfromValues( tmpValue );
        }
        return tmpValue;
    }
    return '';
};
/**
 * Return request criteria
 * @param {Object} subPanelContext subPanelContext
 * @param {Object} searchModeValue Search Mode
 * @returns {Object} request criteria
 */
let getRequestCriteria = function( subPanelContext, searchModeValue ) {
    var context = appCtxSvc.getCtx( 'ac0FeedFilter' );
    if( typeof context === 'undefined' ) {
        const stateParams = AwStateService.instance.params;
        const savedQueryParameters = stateParams.savedQueryParameters;

        var varPrivatePublicAny = '';
        var varhasSnapshot = '';
        var varDateCreatedBefore = '';
        var varDateCreatedAfter = '';
        var varContributors = '';
        var varParticipants = '';
        var varActionable = '';
        var varActionStatus = '';
        var varActionPriority = '';
        if( savedQueryParameters ) {
            const savedQueryMap = advancedSearchUtils.getSavedQueryAttributesFromURL( savedQueryParameters );
            const savedQueryAttributes = savedQueryMap.savedQueryAttributesMap;
            const newSearchState = { ...subPanelContext.searchState };
            newSearchState.savedQueryAttributes = savedQueryAttributes;
            subPanelContext.searchState = newSearchState;

            varPrivatePublicAny = populateFilterParametersFromState( savedQueryAttributes.ac0IsPrivate );
            varhasSnapshot = populateFilterParametersFromState( savedQueryAttributes.ac0HasSnapshot );
            varDateCreatedBefore = populateFilterParametersFromState( savedQueryAttributes.dateCreatedBefore );
            varDateCreatedAfter = populateFilterParametersFromState( savedQueryAttributes.dateCreatedAfter );
            varContributors = populateFilterParametersFromState( savedQueryAttributes.ac0Contributors );
            varParticipants = populateFilterParametersFromState( savedQueryAttributes.ac0PrivateParticipants );
            varActionable = populateFilterParametersFromState( savedQueryAttributes.ac0isActionable );
            varActionStatus = populateFilterParametersFromState( savedQueryAttributes.ac0Status );
            varActionPriority = populateFilterParametersFromState( savedQueryAttributes.ac0Priority );
        }
        context = {
            isPrivate: varPrivatePublicAny,
            hasSnapshot: varhasSnapshot,
            dateCreatedBefore: varDateCreatedBefore,
            dateCreatedAfter: varDateCreatedAfter,
            Contributors: varContributors,
            privateParticipants: varParticipants,
            actionable: varActionable,
            status: varActionStatus,
            priority: varActionPriority
        };
    }


    var privatePUblicAnyVal = 'any';
    if( typeof context.isPrivate !== 'undefined' && context.isPrivate === 'private' || context.isPrivate === 'True' ) {
        privatePUblicAnyVal = 'private';
    } else if( typeof context.isPrivate !== 'undefined' && context.isPrivate === 'public' || context.isPrivate === 'False' ) {
        privatePUblicAnyVal = 'public';
    }
    return {
        SearchMode: searchModeValue,
        FmsBaseUrl: getFmsBaseURL(),
        PrivatePublicAny: privatePUblicAnyVal,
        HasSnapshot: context.hasSnapshot,
        CommentCreatedBefore: context.dateCreatedBefore,
        CommentCreatedAfter: context.dateCreatedAfter,
        Contributors: '',
        Participants: context.privateParticipants,
        Actionable: context.actionable,
        ActionStatus: context.status,
        ActionPriority: context.priority

    };
};

export let getActionableFeedCriteria = function( subPanelContext ) {
    return getRequestCriteria( subPanelContext, 'actionableConversations' );
};

export let getFeedCriteria = function( subPanelContext ) {
    return getRequestCriteria( subPanelContext, 'feedConversations' );
};


export let getAc0ConvCtx = function() {
    var ac0ConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' );
    if( typeof  ac0ConvCtx === 'undefined'  ) {
        ac0ConvCtx = { ac0NumSubscriptionsForSelectedObj : 0 };
        appCtxSvc.registerCtx( 'Ac0ConvCtx', ac0ConvCtx );
    }
    return ac0ConvCtx;
};

export let loadConvSrcObjs = function( ctx ) {
    var deferred = AwPromiseService.instance.defer();
    var response = {};
    response.sourceObjectList = [];
    response.numberOfSourceObjects = 0;
    if( ctx.newConvObj.props.sourceObjList.dbValues.length > 0 ) {
        if( !ctx.newConvObj.props.inflatedSrcObjList
            || ctx.newConvObj.props.inflatedSrcObjList.length !== ctx.newConvObj.props.sourceObjList.dbValues.length ) {
            var srcObjsUids = [];
            ctx.newConvObj.props.inflatedSrcObjList = [];
            for( var ii = 0; ii < ctx.newConvObj.props.sourceObjList.dbValues.length; ii++ ) {
                srcObjsUids.push( ctx.newConvObj.props.sourceObjList.dbValues[ii].uid );
            }
            dmSvc.loadObjects( srcObjsUids ).then( function() {
                var totalNoOfsrc = srcObjsUids.length;
                for( var nn = 0; nn < totalNoOfsrc; nn++ ) { //total no. of participants to be visible initially
                    var srcObj = cdm.getObject( srcObjsUids[nn] );
                    let vmo = viewModelObjectSvc.createViewModelObject( srcObj );
                    ctx.newConvObj.props.inflatedSrcObjList.push( vmo );
                }
                response.sourceObjectList = ctx.newConvObj.props.inflatedSrcObjList;
                response.numberOfSourceObjects = ctx.newConvObj.props.inflatedSrcObjList.length;
                deferred.resolve( response );
            } );
            return deferred.promise;
        }
        response.sourceObjectList = ctx.newConvObj.props.inflatedSrcObjList;
        response.numberOfSourceObjects = ctx.newConvObj.props.inflatedSrcObjList.length;
        deferred.resolve( response );
        return deferred.promise;
    }
    deferred.resolve( response );
    return deferred.promise;
};

export let loadParticipants = function( ctx ) {
    var deferred = AwPromiseService.instance.defer();
    var response = {};
    AwTimeoutService.instance( function() {
        response.participantsList = [];
        response.numberOfParticipants = 0;
        if( ctx.newConvObj && ctx.newConvObj.props && ctx.newConvObj.props.inflatedParticipantObjVMOList ) {
            response.participantsList = ctx.newConvObj.props.inflatedParticipantObjVMOList;
            response.numberOfParticipants = ctx.newConvObj.props.inflatedParticipantObjVMOList.length;
        }
    }, 500 ).then( function() {
        deferred.resolve( response );
    } );
    return deferred.promise;
};

export let loadRelatedObjs = function( ctx ) {
    var deferred = AwPromiseService.instance.defer();
    var response = {};
    AwTimeoutService.instance( function() {
        response.relatedObjectList = [];
        response.numberOfRelatedObjects = 0;
        if( ctx.newConvObj && ctx.newConvObj.props && ctx.newConvObj.props.inflatedRelatedObjList ) {
            response.relatedObjectList = ctx.newConvObj.props.inflatedRelatedObjList;
            response.numberOfRelatedObjects = ctx.newConvObj.props.inflatedRelatedObjList.length;
        }
    }, 500 ).then( function() {
        deferred.resolve( response );
    } );
    return deferred.promise;
};

export let isDiscussionSublocation = function() {
    if( appCtxSvc.getCtx( 'sublocation.clientScopeURI' ) === 'Ac0CollaborationFeed' || appCtxSvc.getCtx( 'sublocation.clientScopeURI' ) === 'Ac0CollaborationActions' ) {
        return true;
    }
    return false;
};

export let isAc0EnableTrackedDiscussions = function() {
    var isTracakble = appCtxSvc.getCtx( 'preferences.Ac0EnableTrackedDiscussions' );
    if( typeof isTracakble !== 'undefined' && isTracakble[0] === 'true' ) {
        return true;
    }
    return false;
};

export let isMyGallerySublocation = function() {
    if( appCtxSvc.getCtx( 'sublocation.clientScopeURI' ) === 'Awv0SnapshotSearchResults' ) {
        return true;
    }
    return false;
};

export let updateLatestCommentInPWA = function( searchState, sharedReplyData ) {
    const newSearchState = { ...searchState.getValue() };
    const loadedCommentsObj = sharedReplyData.value.loadedCommentsObject;
    newSearchState.pwaSelection = searchState.value.pwaSelection;
    newSearchState.pwaSelection[0].latestCommentDetails.hasThumbnail = loadedCommentsObj.loadedComments[ loadedCommentsObj.loadedComments.length - 1 ].hasThumbnail;
    newSearchState.pwaSelection[0].latestCommentDetails.thumbnailUrl = loadedCommentsObj.loadedComments[ loadedCommentsObj.loadedComments.length - 1 ].thumbnailUrl;
    newSearchState.pwaSelection[0].latestCommentDetails.props = loadedCommentsObj.loadedComments[ loadedCommentsObj.loadedComments.length - 1 ].props;
    //newSearchState.pwaSelection[0].props.numReplies.dbValue++;

    searchState.update( newSearchState );
};


export let updateDiscussionTrackedInfo = function( searchState, discussionItem, status ) {
    const newSearchState = { ...searchState.getValue() };
    newSearchState.pwaSelection = searchState.value.pwaSelection;
    newSearchState.pwaSelection[0].props.collabStatus.dbValue = status.dbValue.propDisplayValue;
    newSearchState.pwaSelection[0].props.collabStatus.dbValues = status.dbValue.propDisplayValue;
    newSearchState.pwaSelection[0].props.collabStatus.value = status.dbValue.propDisplayValue;
    newSearchState.pwaSelection[0].props.collabStatus.displayValues[0] = status.dbValue.propDisplayValue;


    newSearchState.pwaSelection[0].props.convStatus.dbValue = status.dbValue.propDisplayValue;
    newSearchState.pwaSelection[0].props.convStatus.dbValues = status.dbValue.propDisplayValue;
    newSearchState.pwaSelection[0].props.convStatus.value = status.dbValue.propDisplayValue;
    newSearchState.pwaSelection[0].props.convStatus.displayValues[0] = status.dbValue.propDisplayValue;

    searchState.update( newSearchState );
};

export let onObjPanelInit = () => {
    appCtxSvc.updateCtx( 'Ac0ConvCtx.editConvCtx', null );
};

export let convertToButtonChipObj = ( regObj ) => {
    if( regObj && regObj.props ) {
        if( regObj.props.user_name && regObj.props.user_name.uiValue ) {
            return {
                uiIconId: 'miscRemoveBreadcrumb',
                chipType: 'BUTTON',
                labelDisplayName: regObj.props.user_name.uiValue,
                labelInternalName: regObj.props.user_name.uiValue,
                theObject: regObj
            };
        }
        if( regObj.props.object_string && regObj.props.object_string.dbValue ) {
            return {
                uiIconId: 'miscRemoveBreadcrumb',
                chipType: 'BUTTON',
                labelDisplayName: regObj.props.object_string.dbValue,
                labelInternalName: regObj.props.object_string.dbValue,
                theObject: regObj
            };
        }
        return {};  //if no user_name or object_string return empty
    }
    return {}; //if no regObj or no regObj.props return empty
};
/**
 * @function processOutput
 * @param {*} data - response
 * @param {*} searchState - searchState
 */
export const processOutput = ( data, dataCtxNode, searchState ) => {
    const newSearchData = { ...searchState.value };
    // generic
    newSearchData.totalFound = data.data.userSession.user.collabFeedConversationList.totalFound;
    newSearchData.startIndex = data.data.userSession.user.collabFeedConversationList.cursor.startIndex;
    newSearchData.startReached = data.data.userSession.user.collabFeedConversationList.cursor.startReached;
    newSearchData.endIndex = data.data.userSession.user.collabFeedConversationList.cursor.endIndex;
    newSearchData.endReached = data.data.userSession.user.collabFeedConversationList.cursor.endReached;
    newSearchData.lastEndIndex = data.data.userSession.user.collabFeedConversationList.cursor.endIndex;
    newSearchData.searchString = searchState.criteria ? searchState.criteria.searchString : '';
    if( typeof newSearchData.totalLoaded !== 'undefined' && newSearchData.totalLoaded !== null ) {
        newSearchData.totalLoaded += data.data.userSession.user.collabFeedConversationList.results.length;
    } else {
        newSearchData.totalLoaded = data.data.userSession.user.collabFeedConversationList.results.length;
    }

    // update state
    searchState.update( newSearchData );
};

let setFilterBreadcrumbDisplayValuesWhenURLValuesSet = async function( searchObject ) {
    if( typeof searchObject.filterBreadcrumbDisplayValues === 'undefined' ) {
        const stateParams = AwStateService.instance.params;
        const savedQueryParameters = stateParams.savedQueryParameters;
        if( typeof savedQueryParameters !== 'undefined' ) {
            // We do not have the correct display values so we are using
            // 'applied_filters' until a better solution is found.
            return 'applied_filters';
        }
    }
    return searchObject.filterBreadcrumbDisplayValues;
};

let breadcrumbMessageForNoResults = async function( searchObject, filterBreadcrumbDisplayValues ) {
    if( typeof filterBreadcrumbDisplayValues !== 'undefined' && filterBreadcrumbDisplayValues !== '' ) {
        if( filterBreadcrumbDisplayValues === 'applied_filters' ) {
            // We do not have the correct display values so we are using
            // 'for applied filters' until a better solution is found.
            return await localeService.getLocalizedTextFromKey( 'ActiveCollabDeclarativeMessages.discussionLocationBreadcrumbWithFiltersNoResultsAppliedFilters' ).then( ( localizedText ) => {
                return localizedText;
            } );
        }
        return localeService.getLocalizedTextFromKey( 'ActiveCollabDeclarativeMessages.discussionLocationBreadcrumbWithFiltersNoResults' ).then( ( localizedText ) => {
            return localizedText.format( filterBreadcrumbDisplayValues );
        } );
    }
    return localeService.getLocalizedTextFromKey( 'ActiveCollabDeclarativeMessages.discussionLocationBreadcrumbNoResults' ).then( ( localizedText ) => {
        return localizedText;
    } );
};

let breadcrumbMessageForOneResult = async function( searchObject, filterBreadcrumbDisplayValues ) {
    if( typeof filterBreadcrumbDisplayValues !== 'undefined' && filterBreadcrumbDisplayValues !== '' ) {
        if( filterBreadcrumbDisplayValues === 'applied_filters' ) {
            // We do not have the correct display values so we are using
            // 'for applied filters' until a better solution is found.
            return await localeService.getLocalizedTextFromKey( 'ActiveCollabDeclarativeMessages.discussionLocationBreadcrumbWithFiltersSingleAppliedFilters' ).then( ( localizedText ) => {
                return localizedText;
            } );
        }
        return localeService.getLocalizedTextFromKey( 'ActiveCollabDeclarativeMessages.discussionLocationBreadcrumbWithFiltersSingle' ).then( ( localizedText ) => {
            return localizedText.format( filterBreadcrumbDisplayValues );
        } );
    }
    return localeService.getLocalizedTextFromKey( 'ActiveCollabDeclarativeMessages.discussionLocationBreadcrumbNoFiltersSingle' ).then( ( localizedText ) => {
        return localizedText.format( searchObject.totalFound );
    } );
};

let breadcrumbMessageForMultipleResults = async function( searchObject, filterBreadcrumbDisplayValues ) {
    if( typeof filterBreadcrumbDisplayValues !== 'undefined' && filterBreadcrumbDisplayValues !== '' ) {
        if( filterBreadcrumbDisplayValues === 'applied_filters' ) {
            // We do not have the correct display values so we are using
            // 'for applied filters' until a better solution is found.
            return await localeService.getLocalizedTextFromKey( 'ActiveCollabDeclarativeMessages.discussionLocationBreadcrumbWithFiltersAppliedFilters' ).then( ( localizedText ) => {
                return localizedText.format( searchObject.totalFound );
            } );
        }
        return localeService.getLocalizedTextFromKey( 'ActiveCollabDeclarativeMessages.discussionLocationBreadcrumbWithFilters' ).then( ( localizedText ) => {
            return localizedText.format( searchObject.totalFound, filterBreadcrumbDisplayValues );
        } );
    }
    return localeService.getLocalizedTextFromKey( 'ActiveCollabDeclarativeMessages.discussionLocationBreadcrumbNoFilters' ).then( ( localizedText ) => {
        return localizedText.format( searchObject.totalFound );
    } );
};

/**
 * buildAdvancedSearchTitle
 * @function buildAdvancedSearchTitle
 * @param {Object}searchObject - search state object
 * @return {Promise} Promise containing the localized text
 */
export let buildFeedBreadcrumbTitle = async function( searchObject ) {
    if( searchObject ) {
        if( searchObject && searchObject.totalFound === undefined  ) {
            // when doing a search, Loading... text should be shown till the SOA call comes back with response.
            return localeService.getLocalizedTextFromKey( 'BaseMessages.LOADING_TEXT' ).then( ( localizedText ) => {
                return localizedText;
            } );
        }

        var filterBreadcrumbDisplayValues = await setFilterBreadcrumbDisplayValuesWhenURLValuesSet( searchObject );
        if( searchObject.searchFilterMap && searchObject.totalFound === 1 ) {
            return breadcrumbMessageForOneResult( searchObject, filterBreadcrumbDisplayValues );
        }
        if( searchObject.searchFilterMap && searchObject.totalFound > 0 ) {
            return breadcrumbMessageForMultipleResults( searchObject, filterBreadcrumbDisplayValues );
        } else if( searchObject.searchFilterMap && searchObject.totalFound === 0 ) {
            return breadcrumbMessageForNoResults( searchObject, filterBreadcrumbDisplayValues );
        }
        // return default text
        return localeService.getLocalizedTextFromKey( 'ActiveCollabDeclarativeMessages.feedSubLocationDefaultMessage' ).then( ( localizedText ) => {
            return localizedText;
        } );
    }
    return Promise.resolve( {} );
};

/**
 * Ac0ConversationUtils factory
 */

export default exports = {
    processRichText,
    processPlainText,
    getObjectUID,
    getCursorEndIndexValue,
    getCursorEndReachedValue,
    getCursorStartReachedValue,
    removeObjectsFromDPCollection,
    getConvObjectUID,
    initCommentsPanel,
    setSelectedObjectInContext,
    setObjectDisplayData,
    saveDeleteConvItemInContext,
    getFmsBaseURL,
    callActiveCollabSoa,
    confirmDeleteConv,
    getFeedCriteria,
    getActionableFeedCriteria,
    getAc0ConvCtx,
    loadConvSrcObjs,
    loadParticipants,
    loadRelatedObjs,
    isDiscussionSublocation,
    isAc0EnableTrackedDiscussions,
    updateLatestCommentInPWA,
    updateDiscussionTrackedInfo,
    onObjPanelInit,
    isMyGallerySublocation,
    getObjectUIDOnOpenPanel,
    getFileTickerURL,
    getSearchMode,
    convertToButtonChipObj,
    processOutput,
    buildFeedBreadcrumbTitle
};
