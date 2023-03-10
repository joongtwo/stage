// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ac0DiscussionTileService
 */
import _ from 'lodash';
import ac0CreateConvSvc from 'js/Ac0CreateCollabObjectService';
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import convUtils from 'js/Ac0ConversationUtils';

var exports = {};

export let initDiscussionTile = function( replyDiscussion, convItem, i18n, sharedData ) {
    var  numOfReplies = convItem.props.numReplies ? convItem.props.numReplies.dbValue : 0;
    var  showFollowConv = convItem.showFollowConv;
    var repliesString;
    if( numOfReplies === 0 ) {
        repliesString = i18n.reply;
    } else{
        repliesString = numOfReplies + ' ' + ( numOfReplies === 1 ? i18n.reply : i18n.replies );
    }
    const newReplyDiscussion = _.clone( replyDiscussion );
    newReplyDiscussion.repliesString = repliesString;
    newReplyDiscussion.showFollowConv = showFollowConv;
    if( typeof sharedData !== 'undefined' && typeof sharedData.trackedStatus !== 'undefined' && convItem.props.convStatus && convItem.props.convStatus.dbValue !== '' ) {
        const newsharedData = { ...sharedData.value };
        newsharedData.trackedStatus = convItem.props.convStatus.dbValue;
        sharedData.update && sharedData.update( newsharedData );
    }
    return newReplyDiscussion;
};

export let initDiscussionSubscription = function( subUnSubToConvSwitch, convItem ) {
    var  showFollowConv = convItem.showFollowConv;
    var newSubUnSubToConvSwitch = _.clone( subUnSubToConvSwitch );
    newSubUnSubToConvSwitch.showFollowConv = showFollowConv;
    return newSubUnSubToConvSwitch;
};

export let buildRepliesText = function( expandCommentsLink, replyDiscussion ) {
    const newExpandCommentsLink = _.clone( expandCommentsLink );
    newExpandCommentsLink.propertyDisplayName = replyDiscussion.value.repliesString;
    return newExpandCommentsLink;
};

export let showHideReplyBoxContents = function( data, replyDiscussion ) {
    var newHideReplyBox = _.clone( data.hideReplyBox );
    newHideReplyBox = !replyDiscussion.value.discussionIsExpanded;
    return newHideReplyBox;
};

export let expandDiscussionAction = function( expandCollapseSwitchObj, replyDiscussion ) {
    var newExpandCollapseSwitchObj = _.clone( expandCollapseSwitchObj );
    newExpandCollapseSwitchObj.showExpandDiscussion  = false;
    newExpandCollapseSwitchObj.showCollapseDiscussion  = true;
    const newReplyDiscussion = { ...replyDiscussion.value };
    newReplyDiscussion.discussionIsExpanded = true;
    replyDiscussion.update && replyDiscussion.update( newReplyDiscussion );
    return newExpandCollapseSwitchObj;
};

export let collapseDiscussionAction = function( expandCollapseSwitchObj, replyDiscussion ) {
    var newExpandCollapseSwitchObj = _.clone( expandCollapseSwitchObj );
    newExpandCollapseSwitchObj.showExpandDiscussion  = true;
    newExpandCollapseSwitchObj.showCollapseDiscussion  = false;
    const newReplyDiscussion = { ...replyDiscussion.value };
    newReplyDiscussion.discussionIsExpanded = false;
    replyDiscussion.update && replyDiscussion.update( newReplyDiscussion );
    return newExpandCollapseSwitchObj;
};

export let showMoreCommentText = function( expandCollapseComments, commentObject ) {
    var newExpandCollapseComments = _.clone( expandCollapseComments );
    newExpandCollapseComments.showMoreCommentText  = false;
    newExpandCollapseComments.showLessCommentText  = true;
    commentObject.showMore = false;
    commentObject.showMoreLink = false;
    commentObject.showLessLink = true;
    return newExpandCollapseComments;
};

export let showLessCommentText = function( expandCollapseComments, commentObject ) {
    var newExpandCollapseComments = _.clone( expandCollapseComments );
    newExpandCollapseComments.showMoreCommentText  = true;
    newExpandCollapseComments.showLessCommentText  = false;
    commentObject.showMore = true;
    commentObject.showMoreLink = true;
    commentObject.showLessLink = false;
    return newExpandCollapseComments;
};

export let followDiscussionAction = function( subUnSubToConvSwitch ) {
    var newSubUnSubToConvSwitch = _.clone( subUnSubToConvSwitch );
    if ( convUtils.isDiscussionSublocation() ) {
        newSubUnSubToConvSwitch.showFollowConv = false;
    }
    return newSubUnSubToConvSwitch;
};

export let unFollowDiscussionAction = function( subUnSubToConvSwitch ) {
    var newSubUnSubToConvSwitch = _.clone( subUnSubToConvSwitch );
    if ( convUtils.isDiscussionSublocation() ) {
        newSubUnSubToConvSwitch.showFollowConv = true;
    }
    return newSubUnSubToConvSwitch;
};

export let invokeShowRichTextEditor = function( vmData, ckeIdRef ) {
    var deferred = AwPromiseService.instance.defer();
    var newCkeObj = _.clone( vmData.ckeInstance );
    if( vmData.hideReplyBox && vmData.ckeInstance && vmData.ckeInstance.cke && vmData.ckeInstance.cke._instance ) {
        vmData.ckeInstance.cke.destroy();
        vmData.ckeInstance = {};
        deferred.resolve( {} );
        return deferred.promise;
    }
    if( !vmData.hideReplyBox && vmData.data && _.isEmpty( vmData.data.cke ) ) {
        var insertImgEvtStr = 'ac0InsertImg.' + ckeIdRef + Math.floor( 100000000 * Math.random() );
        ac0CreateConvSvc.showRichTextEditor( vmData, ckeIdRef, insertImgEvtStr, '' ).then( function( ckeInstance ) {
            deferred.resolve( ckeInstance );
        } );
        return deferred.promise;
    }
    deferred.resolve( newCkeObj );
    return deferred.promise;
};

export const navigateToDiscussionsPanel = ( sharedData ) => {
    if ( convUtils.isDiscussionSublocation() ) {
        eventBus.publish( 'ac0DiscussLocation.saveOrDiscard' );
    }
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'Ac0UnivConvPanelSub';
    resetSharedDataStateForDiscussionPanel( newSharedData );
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

export const backToDiscussionsActionData = ( sharedData ) => {
    if ( convUtils.isDiscussionSublocation() ) {
        eventBus.publish( 'ac0DiscussLocation.saveOrDiscard' );
    }
    const newSharedData = _.clone( sharedData );
    newSharedData.activeView = 'Ac0UnivConvPanelSub';
    resetSharedDataStateForDiscussionPanel( newSharedData );
    return newSharedData;
};

const resetSharedDataStateForDiscussionPanel = ( newSharedData ) => {
    newSharedData.addedSourceObjects = [];
    newSharedData.addedUserObjects = [];
    newSharedData.isTracked = false;
    newSharedData.isPrivate = false;
    newSharedData.trackedStatus = '';
    newSharedData.trackedPriority = '';
    newSharedData.ckeText = '';
    if( newSharedData.currentSelectedSnapshot ) {
        newSharedData.currentSelectedSnapshot = null;
        newSharedData.updateSnapshotOnDiscussion = !newSharedData.updateSnapshotOnDiscussion;
    }
};

export const navigateToCreateCollabObjPanel = ( sharedData ) => {
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'Ac0CreateNewCollabObj';
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

export const backToCreateActionData = ( sharedData ) => {
    const newSharedData = _.clone( sharedData );
    newSharedData.activeView = 'Ac0CreateNewCollabObj';
    return newSharedData;
};

export const toAddSourceObjData = ( sharedData, ckEditor ) => {
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'Ac0AddSourceObjectsSub';
    newSharedData.ckeText = ac0CreateConvSvc.getRichText( ckEditor );
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

export const toAddParticipantObjData = ( sharedData, ckEditor ) => {
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'AwPeoplePicker';
    newSharedData.ckeText = ac0CreateConvSvc.getRichText( ckEditor );
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

//Helper function to save ckeditor text before snapshot rename panel open
export const toRenameSnapPanel = ( ckEditor ) => {
    var convCtx = convUtils.getAc0ConvCtx();
    convCtx.ckEditorRename = ac0CreateConvSvc.getRichText( ckEditor );
};

export const updateMetaObjLinks = ( link, text ) => {
    if( typeof  text  !== 'undefined' ) {
        const newLink = _.clone( link );
        newLink.propertyDisplayName = text;
        return newLink;
    }
};

export const updateTrackedInfo = ( data, convStatus ) => {
    if( typeof convStatus  !== 'undefined' && convUtils.isDiscussionSublocation() ) {
        var newData = _.clone( data );
        newData.convStatus = convStatus;
        return newData.convStatus;
    }
};

export const updateSharedDataRenderText = ( sharedData, commentObj ) => {
    if( typeof sharedData  !== 'undefined' && convUtils.isDiscussionSublocation() ) {
        let updatedsnapshotPanelData = { ...sharedData.getValue() };
        updatedsnapshotPanelData.renderTextbox = !updatedsnapshotPanelData.renderTextbox;
        sharedData.update( updatedsnapshotPanelData );
    }
};

export let updateSharedDataWithUsersAndActiveView = function( sharedData, userObjects ) {
    const newSharedData = _.clone( sharedData );

    // First check if there have been any users added previously
    // if none have been added, add the current user to the list
    // this is to maintain the same functionality as AW 6.1 and prior versions
    if( sharedData.addedUserObjects.length === 0 ) {
        var currentuser = appCtxSvc.getCtx( 'user' );
        newSharedData.addedUserObjects.push( convUtils.convertToButtonChipObj( currentuser ) );
    }

    let uniqueUserChipList = convertUserObjectsToUniqueUserChipList( sharedData, userObjects );
    newSharedData.addedUserObjects = [ ...uniqueUserChipList ];
    newSharedData.activeView = 'Ac0CreateNewCollabObj';
    return newSharedData;
};

export let convertUserObjectsToUniqueUserChipList = function( sharedData, userObjects ) {
    _.forEach( userObjects, ( usrObj ) => {
        sharedData.addedUserObjects.push( convUtils.convertToButtonChipObj( usrObj ) );
    } );
    _.remove( sharedData.addedUserObjects, ( userObj ) => {
        return _.isEmpty( userObj );
    } );
    return _.uniqBy( sharedData.addedUserObjects, 'labelDisplayName' );
};

export default exports = {
    initDiscussionTile,
    showHideReplyBoxContents,
    expandDiscussionAction,
    collapseDiscussionAction,
    invokeShowRichTextEditor,
    backToDiscussionsActionData,
    backToCreateActionData,
    toAddSourceObjData,
    toAddParticipantObjData,
    navigateToCreateCollabObjPanel,
    navigateToDiscussionsPanel,
    updateMetaObjLinks,
    buildRepliesText,
    updateSharedDataWithUsersAndActiveView,
    convertUserObjectsToUniqueUserChipList,
    followDiscussionAction,
    unFollowDiscussionAction,
    initDiscussionSubscription,
    showMoreCommentText,
    showLessCommentText,
    updateTrackedInfo,
    updateSharedDataRenderText,
    toRenameSnapPanel
};
