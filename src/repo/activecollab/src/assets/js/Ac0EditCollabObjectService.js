// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ac0EditCollabObjectService
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import createConvSvc from 'js/Ac0CreateCollabObjectService';
import AwPromiseService from 'js/awPromiseService';
import ac0CreateConvSvc from 'js/Ac0CreateCollabObjectService';
import convUtils from 'js/Ac0ConversationUtils';
import cmdPanelSvc from 'js/commandPanel.service';
import dissTileSvc from 'js/Ac0DiscussionTileService';
import _ from 'lodash';

var exports = {};
var editCommentCompleteEvtStr = 'ac0EditComm.editCommentComplete';

export let doEditConversationCell = function( subPanelContext, sharedData, title ) {
    var convCtx = convUtils.getAc0ConvCtx();
    convCtx.editConvCtx = subPanelContext; //this is the flag that determines if we are in edit mode for a discussion. Setting this to null will mean edit is either complete or discarded
    if( convCtx.activeCell ) {
        convCtx.activeCell.expandComments = false;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    //ac0ConvSvc.destroyActiveCellCkeEditor();
    createConvSvc.modifyCreateCtxFlagsForCollabObjs( true, false );
    if( convUtils.isDiscussionSublocation() ) {
        cmdPanelSvc.activateCommandPanel( 'Ac0UniversalConversationPanel', 'aw_toolsAndInfo' );
        return;
    }
    // var navContext = {
    //     destPanelId: 'Ac0CreateNewCollabObj',
    //     title: title,
    //     recreatePanel: true,
    //     isolateMode: false,
    //     supportGoBack: true
    // };
    // eventBus.publish( 'awPanel.navigate', navContext );
    dissTileSvc.navigateToCreateCollabObjPanel( sharedData );
};

export let shareSnapshotInDiscussion = function( commandcontext, mode, entryPoint ) {
    var convCtx = convUtils.getAc0ConvCtx();
    //vmo passed in commandcontext differently for table view, image view in MyGallery
    if( commandcontext.selected ) {
        convCtx.currentSelectedSnapshot = commandcontext.selected[0];
    }else{
        convCtx.currentSelectedSnapshot = commandcontext.vmo;
    }
    convCtx.snapshotEntryPoint = entryPoint;
    if ( !convUtils.isMyGallerySublocation() ||  convUtils.isMyGallerySublocation() && mode === 'open' ) {
        convUtils.setSelectedObjectInContext();
    }
    if ( convUtils.isMyGallerySublocation() && mode === 'create' ) {
        convCtx.snapshotObjfnd0Roots = convCtx.currentSelectedSnapshot.props.fnd0Roots;
    }
    if( convCtx.activeCell ) {
        convCtx.activeCell.expandComments = false;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    //ac0ConvSvc.destroyActiveCellCkeEditor();
    createConvSvc.modifyCreateCtxFlagsForCollabObjs( true, false );
    convCtx.editConvCtx = null; //coming from create. Make this flag null.
    convCtx.snapMode = mode;
    cmdPanelSvc.activateCommandPanel( 'Ac0UniversalConversationPanel', 'aw_toolsAndInfo', convCtx );
};

export let doEditCommentCell = function( subPanelContext, sharedData, commentItemObj, ctx ) {
    var deferred = AwPromiseService.instance.defer();
    var convCtx = convUtils.getAc0ConvCtx();
    if( convCtx.cmtEdit.activeCommentToEdit && convCtx.cmtEdit.activeCommentToEdit.beingEdited ) {
        convCtx.cmtEdit.activeCommentToEdit.beingEdited = false; //set existing activeComment beingEdited to false
    }
    if( convUtils.isDiscussionSublocation() && !commentItemObj )  {
        commentItemObj = ctx.newConvObj;
    }
    convCtx.cmtEdit.activeCommentToEdit = commentItemObj; //replace activeComment

    convCtx.cmtEdit.activeVMData = sharedData;
    convCtx.cmtEdit.activeConvObj = subPanelContext;
    convCtx.editConvCtx = null; //in case this var has been set when a discussion has been edited, reset it
    convCtx.cmtEdit.activeCommentToEdit.beingEdited = true;

    const newSharedData = { ...sharedData.value };
    newSharedData.beingEdited = true;
    sharedData.update && sharedData.update( newSharedData );

    if( commentItemObj.isRootComment && commentItemObj.discussionHasSnapshot ) {
        convCtx.cmtEdit.removedSnapshotObj = null; //cell in the process of being put into edit. No snapshot removed yet.
    } else {
        delete convCtx.cmtEdit.removedSnapshotObj;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    ac0CreateConvSvc.showRichTextEditor( sharedData, commentItemObj.commentCKEId, subPanelContext.ckeImgUploadEvent ).then( function( ckeInstance ) {
        var convContext = convUtils.getAc0ConvCtx();
        convContext.cmtEdit.activeCKEInstance = ckeInstance;
        ac0CreateConvSvc.setCkEditorData( commentItemObj.props.richText.displayValues[0], ckeInstance );
        appCtxSvc.registerCtx( 'Ac0ConvCtx', convContext );
        //convContext.ckeInstance = ckeInstance;
        deferred.resolve( {} );
    } );
    return deferred.promise;
};

export let saveEditComment = function( commentObj, sharedData ) {
    var convCtx = convUtils.getAc0ConvCtx();
    var convObj = convCtx.cmtEdit.activeConvObj;
    var richText = ac0CreateConvSvc.getRichText( convCtx.createCollabObjData.ckeInstance._instance );
    var hasSnapshotBeenRemoved = convCtx.cmtEdit.removedSnapshotObj;
    return createConvSvc.postComment( convObj, richText, commentObj, null, hasSnapshotBeenRemoved ).then( function( response ) {
        var convContext = convUtils.getAc0ConvCtx();
        convContext.cmtEdit.activeCommentToEdit.props.richText.displayValues[0] = richText;
        convContext.cmtEdit.activeCommentToEdit.beingEdited = false;
        convContext.cmtEdit.activeCKEInstance = null;
        convContext.cmtEdit.activeVMData = null;
        convContext.cmtEdit.activeConvObj = null;
        convCtx.cmtEdit.removedSnapshotObj = null;
        appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
        createConvSvc.checkCKEInputTextValidityAndPublishEvent( convCtx.createCollabObjData.ckeInstance );
        dissTileSvc.navigateToDiscussionsPanel( sharedData );
    }, function( error ) {
        eventBus.publish( editCommentCompleteEvtStr );
    } );
};

export let discardEditComment = function( commentObj, sharedData ) {
    var convCtx = convUtils.getAc0ConvCtx();
    convCtx.cmtEdit.activeCommentToEdit.beingEdited = false;
    convCtx.cmtEdit.activeCKEInstance = null;
    convCtx.cmtEdit.activeVMData = null;
    convCtx.cmtEdit.rootCmtObj = null;
    if( convCtx.cmtEdit.removedSnapshotObj ) {
        convCtx.cmtEdit.activeConvObj.props.inflatedRelatedObjList = convCtx.cmtEdit.removedSnapshotObj;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    createConvSvc.checkCKEInputTextValidityAndPublishEvent( convCtx.createCollabObjData.ckeInstance );
    //eventBus.publish( 'ac0EditComm.editCommentComplete' );
    const newSharedData = { ...sharedData.value };
    newSharedData.beingEdited = false;
    sharedData.update && sharedData.update( newSharedData );
};

/*
* @param {Object} vmData view model data
*/
export let editInDiscussionLoctionPanelReveal = function( vmData ) {
    vmData.activeView = 'Ac0CreateNewCollabObj';
};

export let removeSnapshotFromRootComment = function( commandcontext ) {
    var convCtx = convUtils.getAc0ConvCtx();
    convCtx.cmtEdit.removedSnapshotObj = _.remove( commandcontext.commentDetails.props.inflatedRelatedObjList, function( relatedObj ) {
        return relatedObj.type === 'Fnd0Snapshot';
    } );
    const newSharedData = { ...commandcontext.sharedData.value };
    commandcontext.sharedData.update && commandcontext.sharedData.update( newSharedData );
    convCtx.validForSave = true;
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
};
/**
 * Ac0EditCollabObjectService factory
 */

export default exports = {
    doEditConversationCell,
    doEditCommentCell,
    saveEditComment,
    discardEditComment,
    editInDiscussionLoctionPanelReveal,
    shareSnapshotInDiscussion,
    removeSnapshotFromRootComment
};
