/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ac0ConversationService
 */
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import uwPropSvc from 'js/uwPropertyService';
import vmoSvc from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import createConvSvc from 'js/Ac0CreateCollabObjectService';
import dms from 'soa/dataManagementService';
import awIconSvc from 'js/awIconService';
import convUtils from 'js/Ac0ConversationUtils';
import policySvc from 'soa/kernel/propertyPolicyService';
import ac0NotySvc from 'js/Ac0NotificationService';
import ac0EditSvc from 'js/Ac0EditCollabObjectService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import graphQLSvc from 'js/graphQLService';
import soaSvc from 'soa/kernel/soaService';
import declUtils from 'js/declUtils';
import dateTimeSvc from 'js/dateTimeService';
import msgSvc from 'js/messagingService';
import browserUtils from 'js/browserUtils';
import sanitizer from 'js/sanitizer';
import AwStateService from 'js/awStateService';

var exports = {};

var parentData = {};

var selectedConv = {};

export let feedLocationReveal = function( activeView ) {
    var newActiveViewVal = _.clone( activeView );
    newActiveViewVal = 'Ac0FeedSummary';
    return newActiveViewVal;
};

// ****************************************************************************
// Begin block of internally called functions
// Generally a function should be declared in a file before it is used.
// ****************************************************************************


/**
 * method to prepare comment cell. This method dresses up the 'root comment' cell as well as other comments.
 * For root comment, all params are passed. For individual comments, index and vmData are optional.
 * @param {*} vmObject ViewModelObject
 * @param {*} plainText plain text comment
 * @param {*} richText rich text comment
 * @param {*} index optional - index of root comment in conversation search result. Necessary for unique id in view.
 * @param {*} vmData optional - ViewModelData where Conversation resides. Needed for i18n strings
 */
var prepareCommentCellViewModelObject = function( vmObject, plainText, richText, index, vmData ) {
    //prep chip data section

    vmObject.isSourceObjVisible = false;
    vmObject.isParticipantObjVisible = false;

    setupTileSourceObjInfo( vmObject, index, vmData );

    return setupTileParticipantInfo( vmObject, index, vmData ).then( () => {
        //prep plainText/richText comment setion
        vmObject.props.curtailedComment = plainText;

        setupTileMoreLessSection( vmObject, richText, plainText, vmData );

        vmObject.hasThumbnail = false;
        if( vmObject.thumbnailUrl ) {
            vmObject.hasThumbnail = true;
        }

        if( vmObject.props.userName && vmObject.props.userName.displayValues[0] ) {
            vmObject.props.userName.displayValues[0] = vmObject.props.userName.displayValues[0].split( '(' )[0].trim();
        }

        if( vmObject.props.modifiedDateTime && vmObject.props.modifiedDateTime.dbValues !== null ) {
            var twentyFourHours = 24 * 60 * 60 * 1000;
            var timeInMs = Date.now();
            var conversationModifiedDateTime = new Date( vmObject.props.modifiedDateTime.dbValues ).getTime();
            if ( timeInMs - conversationModifiedDateTime  > twentyFourHours ) {
                vmObject.props.modifiedDateTime.displayValues[0] = vmObject.props.modifiedDateTime.displayValues[0].split( ' ' )[0];
            } else{
                vmObject.props.modifiedDateTime.displayValues[0] = new Date( vmObject.props.modifiedDateTime.dbValues ).toLocaleTimeString( [], { hour: '2-digit', minute: '2-digit' } );
            }
        }
        //add ckeditor id ref to vmObject
        vmObject.ckEditorIdRef = 'ckeditor_cmtReply_' + index;

        //Update latest comment dateTime
        vmObject.hasReplies = false;
        vmObject.haslatestCommentThumbnail = false;
        if( vmObject.props.numReplies ) {
            if( vmObject.props.numReplies.dbValue > 0 && vmObject.props.latestCommentmodifiedDateTime ) {
                if( vmObject.latestCommentthumbnailUrl ) {
                    vmObject.haslatestCommentThumbnail = true;
                }
                vmObject.hasReplies = true;
                var plainTextLC = vmObject.props.latestCommentplainText ? vmObject.props.latestCommentplainText.displayValues[0] : '';
                var richTextLC = vmObject.props.latestCommentrichText ? vmObject.props.latestCommentrichText.displayValues[0] : '';
                var sanitizedRichTxt = sanitizer.sanitizeHtmlValue( richTextLC );
                richTextLC = sanitizedRichTxt;
                if( typeof vmObject.props.latestCommentrichText !== 'undefined' ) {
                    vmObject.props.latestCommentrichText.displayValues[0] = richTextLC;
                }
                setupTileMoreLessSectionLC( vmObject, richTextLC, plainTextLC, vmData );
                if( vmObject.props.latestCommentmodifiedDateTime && vmObject.props.latestCommentmodifiedDateTime.dbValues !== null ) {
                    var twentyFourHours = 24 * 60 * 60 * 1000;
                    var timeInMs = Date.now();
                    var conversationModifiedDateTime = new Date( vmObject.props.latestCommentmodifiedDateTime.dbValues ).getTime();
                    if ( timeInMs - conversationModifiedDateTime  > twentyFourHours ) {
                        vmObject.props.latestCommentmodifiedDateTime.displayValues[0] = vmObject.props.latestCommentmodifiedDateTime.displayValues[0].split( ' ' )[0];
                    } else{
                        vmObject.props.latestCommentmodifiedDateTime.displayValues[0] = new Date( vmObject.props.latestCommentmodifiedDateTime.dbValues ).toLocaleTimeString( [], { hour: '2-digit', minute: '2-digit' } );
                    }
                }
            }
        }
    } );
};

var setupTileMoreLessSectionLC = function( vmObject, richText, plainText, vmData ) {
    vmObject.showMoreLC = false;
    vmObject.showMoreLinkLC = false;
    vmObject.showLessLinkLC = false;

    //prep more/less link section
    if( richText && richText.length > 0 ) {
        vmObject.props.latestCommentrichTextObject = convUtils.processRichText( richText );
        vmObject.showMoreLC = vmObject.props.latestCommentrichTextObject.showMore;
    }else {
        vmObject.props.latestCommentplainTextObject = convUtils.processPlainText( plainText );
        vmObject.showMoreLC = vmObject.props.latestCommentplainTextObject.showMore;
    }
    vmObject.showMoreLinkLC = vmObject.showMoreLC;
};

export let getInflatedSourceObjectList = function( srcObjUids, vmObject ) {
    //load objects in sourceObjectList and retrieve thumbnail for objects
    var deferred = AwPromiseService.instance.defer();
    if( srcObjUids.length > 0 ) {
        vmObject.props.srcObjUids = srcObjUids;
        vmObject.props.inflatedSrcObjList = [];
        return dms.loadObjects( srcObjUids ).then( function() {
            var totalNoOfpart = srcObjUids.length;
            for( var nn = 0; nn < totalNoOfpart; nn++ ) {
                var usrObj = cdm.getObject( srcObjUids[nn] );
                let vmo = viewModelObjectSvc.createViewModelObject( usrObj );
                vmObject.props.inflatedSrcObjList.push( vmo );
            }
            eventBus.publish( 'ac0ActionableFeedSummary.selectionChangeComplete2' );
            eventBus.publish( 'ac0FeedSummary.selectionChangeComplete2' );
        } );
    }
    deferred.resolve( {} );
    return deferred.promise;
};

var setupTileSourceObjInfo = function( vmObject, index, vmData ) {
    //for conversations-
    //display source obj chips only if
    //query returns sourceObjList and it is not an empty array and
    //if sourceObjList length is more than 1, then display
    //if sourceObjList length equals 1 and sourceObj returned isn't the selected context object, then display

    if( vmObject.props.sourceObjList && vmObject.props.sourceObjList.dbValues && vmObject.props.sourceObjList.dbValues.length > 0 ) {
        //setup isSourceObjVisible - > 1 || == 1 and not selected
        //setup chipData - > 1 || == 1 and not selected
        //setup chipData link - > 1 || == 1 and not selected
        //setup more srcObj link - > 1
        //setup more srcObj chips - > 1
        //setup more srcObj chips link
        vmObject.isSourceObjVisible = true;
        vmObject.srcObjIdRef = 'collabSrcObjs_' + index;
        vmObject.chipData.labelDisplayName = vmObject.props.sourceObjList.dbValues[0].object_string;
        vmObject.chipData.labelInternalName = vmObject.props.sourceObjList.dbValues[0].object_string;
        vmObject.chipData.objUid = vmObject.props.sourceObjList.dbValues[0].uid;
        vmObject.chipData.extendedTooltip = {
            extendedTooltipContent: vmObject.props.sourceObjList.dbValues[0].object_string
        };
        var srcObjUids = [];
        for( var ii = 0; ii < vmObject.props.sourceObjList.dbValues.length; ii++ ) {
            srcObjUids.push( vmObject.props.sourceObjList.dbValues[ii].uid );
        }
        getInflatedSourceObjectList( srcObjUids, vmObject );

        if( vmObject.props.sourceObjList.dbValues.length > 1 ) {
            var moreSourceObjPopupLinkString = '+ ' + ( vmObject.props.sourceObjList.dbValues.length - 1 ).toString() + ' ' + vmData.i18n.more;
            vmObject.moreSourceObjPopupLink = uwPropSvc.createViewModelProperty( 'moreSourceObj', moreSourceObjPopupLinkString, 'STRING', 'more' );
        }
        if( vmObject.props.sourceObjList.dbValues.length === 1 && vmObject.props.sourceObjList.dbValues[0].uid === convUtils.getObjectUID( appCtxSvc.getCtx( 'selected' ) ) ) {
            vmObject.isSourceObjVisible = false;
        }
    }
};

export let initMoreSourceObjPopup = ( sourceObjs, sourceObjChips ) => {
    var moreSrcObjList = sourceObjs.dbValues.slice( 1 );
    const newSourceObjChips = _.clone( sourceObjChips );
    for ( var ii = 0; ii < moreSrcObjList.length; ii++ ) {
        var moreSrcObjChip = {
            chipType: 'BUTTON',
            labelDisplayName: moreSrcObjList[ii].object_string,
            labelInternalName: moreSrcObjList[ii].object_string,
            objUid: moreSrcObjList[ii].uid,
            extendedTooltip: {
                extendedTooltipContent: moreSrcObjList[ii].object_string
            }
        };
        newSourceObjChips.srcObjChipList.push( moreSrcObjChip );
    }
    return newSourceObjChips;
};

export let initMoreParticipantPopup = ( participantUids, passedParticipants ) => {
    const newPassedParticipants = _.clone( passedParticipants );
    for( var mm = 3; mm < participantUids.length; mm++ ) {
        var moreUsrObj = cdm.getObject( participantUids[mm] );
        moreUsrObj.props.thumbnailUrl = awIconSvc.getThumbnailFileUrl( moreUsrObj );
        moreUsrObj.props.participantNameTooltip = {
            extendedTooltipContent: moreUsrObj.props.object_string.dbValues[0].split( '(' )[0].trim()
        };
        moreUsrObj.props.displayValue = {
            propertyDisplayName: moreUsrObj.props.object_string.dbValues[0].split( '(' )[0].trim(),
            type: 'STRING'
        };
        newPassedParticipants.participantIconList.push( moreUsrObj );
    }
    return newPassedParticipants;
};

var getInflatedParicipantObjectList = function( participantUids, vmObject ) {
    var deferred = AwPromiseService.instance.defer();
    if( participantUids.length > 0 ) {
        vmObject.props.participantUids = participantUids;
        vmObject.props.inflatedParticipantObjVMOList = [];
        return dms.loadObjects( participantUids ).then( function() {
            var totalNoOfpart = participantUids.length;
            for( var nn = 0; nn < totalNoOfpart; nn++ ) {
                var usrObj = cdm.getObject( participantUids[nn] );
                let vmo = viewModelObjectSvc.createViewModelObject( usrObj );
                vmObject.props.inflatedParticipantObjVMOList.push( vmo );
            }
            eventBus.publish( 'ac0ActionableFeedSummary.selectionChangeComplete2' );
            eventBus.publish( 'ac0FeedSummary.selectionChangeComplete2' );
        } );
    }
    deferred.resolve( {} );
    return deferred.promise;
};

var setupTileParticipantInfo = function( vmObject, index, vmData ) {
    var deferred = AwPromiseService.instance.defer();
    if( vmObject.props.participantObjList && vmObject.props.participantObjList.dbValues && vmObject.props.participantObjList.dbValues.length > 0 && vmObject.props.participantObjList.dbValues[0] ) {
        var participantUids = [];
        vmObject.participantIdRef = 'collabParticipants_' + index;
        for( var ii = 0; ii < vmObject.props.participantObjList.dbValues.length; ii++ ) {
            participantUids.push( vmObject.props.participantObjList.dbValues[ii].uid );
        }
        return getInflatedParicipantObjectList( participantUids, vmObject ).then( () => {
            if( participantUids.length > 0 ) {
                vmObject.props.participantUids = participantUids;
                vmObject.props.inflatedParticipantObjList = [];
                return dms.loadObjects( participantUids ).then( function() {
                    var totalNoOfVisibleParticipants = participantUids.length > 3 ? 3 : participantUids.length;
                    for( var nn = 0; nn < totalNoOfVisibleParticipants; nn++ ) { //total no. of participants to be visible initially
                        var usrObj = cdm.getObject( participantUids[nn] );
                        //Create Participant VMOs
                        let vmo = viewModelObjectSvc.createViewModelObject( usrObj );
                        usrObj.props.thumbnailUrl = awIconSvc.getThumbnailFileUrl( usrObj );
                        usrObj.props.hasThumbnail = true;
                        if( usrObj.props.object_string && usrObj.props.object_string.dbValues ) {
                            usrObj.props.participantNameTooltip = {
                                extendedTooltipContent: usrObj.props.object_string.dbValues[0].split( '(' )[0].trim()
                            };
                        }
                        vmObject.props.inflatedParticipantObjList.push( usrObj );
                    }
                    vmObject.isParticipantObjVisible = true;
                    if( vmObject.props.participantUids.length > 3 ) {
                        var moreParticipantPopupLinkString = '+ ' + ( vmObject.props.participantUids.length - 3 ).toString() + ' ' + vmData.i18n.more;
                        vmObject.moreParticipantPopupLink = uwPropSvc.createViewModelProperty( 'moreParticipant', moreParticipantPopupLinkString, 'STRING', 'more' );
                    }
                } );
            }
        } );
    }
    deferred.resolve( {} );
    return deferred.promise;
};

var setupTileMoreLessSection = function( vmObject, richText, plainText, vmData ) {
    vmObject.showMore = false;
    vmObject.showMoreLink = false;
    vmObject.showLessLink = false;

    //prep more/less link section
    if( richText && richText.length > 0 ) {
        vmObject.props.richTextObject = convUtils.processRichText( richText );
        vmObject.showMore = vmObject.props.richTextObject.showMore;
    }else {
        vmObject.props.plainTextObject = convUtils.processPlainText( plainText );
        vmObject.showMore = vmObject.props.plainTextObject.showMore;
    }

    vmObject.showMoreLink = vmObject.showMore;
    vmObject.expandComments = false;
};

var setupMoreCmtCellCmdInfo = function( vmObject, index, performOwningUserVisibilityCheck ) {
    var indx = index ? index : 'AA';
    vmObject.showMoreCmtCellCmds = true;
    if( performOwningUserVisibilityCheck ) {
        vmObject.showMoreCmtCellCmds = vmObject.props.uid.dbValue === appCtxSvc.getCtx( 'user' ).uid;
    }
    vmObject.moreCmtCellCmdsIdRef = 'collabCmtCmd' + Math.floor( 10000000 * Math.random() ) + '_' + indx;
    vmObject.commentCKEId = 'collabCmtEdit' + Math.floor( 10000000 * Math.random() ) + '_' + indx;
    vmObject.ckeImgUploadEvent = 'ac0EditComm.insertImageInCKEditor_' + vmObject.commentCKEId;
    vmObject.beingEdited = false;
};

var setupCmtEditLink = function( vmObject, vmData, index ) {
    vmObject.doSaveEditComment = function( dpItem ) {
        ac0EditSvc.saveEditComment( dpItem );
    };
    vmObject.doDiscardEditComment = function( dpItem ) {
        ac0EditSvc.discardEditComment( dpItem );
    };
};

/**
 * Method that creates a VMO from the root comment properties
 * @param {*} convProps conversation properties
 * @returns {Object} ViewModelObject
 */
var createRootCommentVMO = function( convProps ) {
    var serverVMO = {
        props: {}
    };
    serverVMO.uid = convProps.rootCommentUID ? convProps.rootCommentUID.displayValues[0] : '';
    serverVMO.props[convProps.richText ? convProps.richText.propertyName : 'collabRichText'] = convProps.richText ? convProps.richText.displayValues[0] : '';
    serverVMO.props[convProps.plainText ? convProps.plainText.propertyName : 'collabPlainText'] = convProps.plainText ? convProps.plainText.displayValues[0] : '';
    return vmoSvc.constructViewModelObject( serverVMO );
};

/**
 * Return the source objects
 * @param {Object} data Data
 * @returns {Object} array of sourceObjects
 */
export let getSourceObjects = function( data ) {
    var sourceObjs = [];
    var sourceTags = data.srcObjChips ? data.srcObjChips : [];
    if( sourceTags ) {
        for ( var i = 0; i < sourceTags.length; i++ ) {
            if( sourceTags[i].theObject ) {
                var tmpObj = null;
                var underlyingObj = sourceTags[i].theObject.props.awb0UnderlyingObject;
                if( typeof underlyingObj !== 'undefined' ) {
                    var cdmObj = cdm.getObject( underlyingObj.dbValues[0] );
                    tmpObj = {
                        uid: underlyingObj.dbValues[0],
                        type: cdmObj.type
                    };
                } else {
                    tmpObj = {
                        uid: sourceTags[i].theObject.uid,
                        type: sourceTags[i].theObject.type
                    };
                }
                sourceObjs.push( tmpObj );
            }
        }
    }
    return sourceObjs;
};

/**
 * Return the source objects
 * @param {Object} data Data
 * @returns {Array} users
 */
export let getUserObjects = function( data ) {
    var userObjs = [];
    if( data.userChipsObj ) {
        var userTags = data.userChipsObj.userChips ? data.userChipsObj.userChips : parentData.userChips;
        if( userTags ) {
            for ( var i = 0; i < userTags.length; i++ ) {
                if( userTags[i].theObject ) {
                    var obj = {
                        uid: userTags[i].theObject.uid,
                        type: userTags[i].theObject.type
                    };
                    userObjs.push( obj );
                }
            }
        }
    }

    return userObjs;
};

/**
 * This method removes a chip from a chip array. Taken from chipShowCaseService.js
 * @param {*} chipArray array of chips from the chip dataprovider
 * @param {*} chipToRemove chip that needs to be removed
 */
export let removeSrcChipObj = function( chipArray, chipToRemove, sharedData ) {
    if( chipToRemove ) {
        _.pullAllBy( chipArray, [ { labelDisplayName: chipToRemove.labelDisplayName } ], 'labelDisplayName' );
        const newSharedData = { ...sharedData.value };
        _.remove( newSharedData.addedSourceObjects, ( srcObj ) => {
            return srcObj.uid === chipToRemove.theObject.uid;
        } );
        let convCtx = convUtils.getAc0ConvCtx();
        if( convCtx.editConvCtx ) {
            _.remove( convCtx.editConvCtx.props.sourceObjList.dbValues, ( srcObj ) => {
                return srcObj.uid === chipToRemove.theObject.uid;
            } );
            appCtxSvc.updateCtx( 'Ac0ConvCtx.editConvCtx', convCtx.editConvCtx );
        }

        if ( convCtx.snapshotObjfnd0Roots && convCtx.currentSelectedSnapshot ) {
            if( chipToRemove.labelDisplayName === convCtx.currentSelectedSnapshot.props.fnd0Roots.displayValues[0] ) {
                convCtx.snapshotObjfnd0Roots = null;
            }
        }
        sharedData.update && sharedData.update( newSharedData );
        eventBus.publish( 'Ac0.validateParticipantSourceReadAccess' );
    }
};

/**
 * This method removes a chip from a chip array. Taken from chipShowCaseService.js
 * @param {*} userChipsObj array of chips from the chip dataprovider
 * @param {*} chipToRemove chip that needs to be removed
 * @param {*} convType type of conversation
 * @param {*} showWarnOnRemovingUserMsg type of conversation
 */
export let removeUserChipObj = function( userChipsObj, chipToRemove, convType, showWarnOnRemovingUserMsg, sharedData ) {
    const newShowWarnOnRemovingUserMsg = showWarnOnRemovingUserMsg ? _.clone( showWarnOnRemovingUserMsg ) : {};
    const newUserChipsObj = userChipsObj.userChips ? _.clone( userChipsObj ) : {};
    _.pullAllBy( newUserChipsObj.userChips, [ { labelDisplayName: chipToRemove.labelDisplayName } ], 'labelDisplayName' );
    const newSharedData = { ...sharedData.value };
    _.remove( newSharedData.addedUserObjects, ( usrObj ) => {
        return usrObj.theObject.uid === chipToRemove.theObject.uid;
    } );
    if( convType && convType.dbValue === 'message' && typeof chipToRemove.theObject.modelType !== 'undefined' && chipToRemove.theObject.modelType.typeHierarchyArray.indexOf( 'User' ) > -1 ) {
        var user = appCtxSvc.getCtx( 'user' );
        var chipExisted = _.find( newUserChipsObj.userChips, function( chip ) {
            return chip.theObject.uid === user.uid;
        } );
        if( !chipExisted ) {
            newShowWarnOnRemovingUserMsg.dbValue = true;
        }
    }
    // let editConvCtx = convUtils.getAc0ConvCtx().editConvCtx;
    // if( editConvCtx ) {
    //     _.remove( editConvCtx.props.participantObjList.dbValues, ( user ) => {
    //         return user.uid === chipToRemove.theObject.uid;
    //     } );
    //     appCtxSvc.updateCtx( 'Ac0ConvCtx.editConvCtx', editConvCtx );
    // }
    sharedData.update && sharedData.update( newSharedData );
    eventBus.publish( 'Ac0.validateParticipantSourceReadAccess' );
    return {
        showWarnOnRemovingUserMsg: newShowWarnOnRemovingUserMsg,
        userChipsObj: newUserChipsObj
    };
};

/**
 * Method that handles selection change updates
 * @param {*} vmData view model data
 */
export let onObjectTabSelectionChange = function( selObjVm, selectionData, sharedData ) {
    var deferred = AwPromiseService.instance.defer();
    const newSelectedObjData = _.clone( selObjVm );
    //Update the context first
    convUtils.setSelectedObjectInContext( null );

    var convCtx = convUtils.getAc0ConvCtx();

    // If the user had opened the discussion panel from the snapshot
    // 'Open Discussion' command and then selects a different object we
    // need to reset the ctx.
    if( convCtx.currentSelectedSnapshot && selObjVm.dbValue && selObjVm.dbValue !== '' ) {
        if( convCtx.snapMode && convCtx.snapMode === 'open' && convCtx.snapshotEntryPoint === 'SnapshotMyGallery' ) {
            /* do nothing*/
        } else {
            unregisterSnapshotDiscussionContextdata();
            convCtx.currentSelectedSnapshot = undefined;
        }
    }

    if( sharedData ) {
        let sharedDataValue = { ...sharedData.getValue() };
        if( sharedDataValue && sharedDataValue.currentSelectedSnapshot ) {
            sharedDataValue.currentSelectedSnapshot = null;
            sharedData.update( sharedDataValue );
        }
    }

    if( selectionData && selectionData.value && selectionData.value.selected[0].props &&
        selectionData.value.selected[0].props.awb0UnderlyingObject ) {
        var underlyingUid = selectionData.value.selected[0].props.awb0UnderlyingObject.dbValues[0];
        dmSvc.getProperties( [ underlyingUid ], [ 'object_name' ] ).then( function( response ) {
            var underlyingObj = cdm.getObject( underlyingUid );
            var dbStringValue = underlyingObj.props.object_name.dbValues[0];
            var uiStringValue = underlyingObj.props.object_name.uiValues[0];
            convCtx.selected = underlyingObj;
            convCtx.selected.props.object_name.dbValue = dbStringValue;
            convCtx.selected.props.object_name.uiValue = uiStringValue;
            newSelectedObjData.dbValue = dbStringValue;
            newSelectedObjData.uiValue = uiStringValue;
            newSelectedObjData.dispValue = uiStringValue;
            // adding missing cellHeader1 data
            selectionData.value.selected[0].cellHeader1 = uiStringValue;
            deferred.resolve( newSelectedObjData );
        } );
    } else {
        //Then update the passed in vm data
        var selectedObjUIValue = '';
        if( typeof selectionData.value.selected[0].cellHeader1 !== 'undefined' ) {
            selectedObjUIValue = selectionData.value.selected[0].cellHeader1;
        } else {
            selectedObjUIValue = selectionData.value.selected[0].props.object_string.uiValues[0];
        }

        newSelectedObjData.dbValue = selectedObjUIValue;
        newSelectedObjData.uiValue = selectedObjUIValue;
        newSelectedObjData.dispValue = selectedObjUIValue;
        deferred.resolve( newSelectedObjData );
    }

    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );

    return deferred.promise;
};

/**
 * Determine if the user has permission to use the delete command
 */
export let deleteCommandValidForCurrentGroupRole = function() {
    var convCtx =  convUtils.getAc0ConvCtx();
    if( typeof convCtx.deleteCommandValidForCurrentGroupRole !== 'undefined' ) {
        return convCtx.deleteCommandValidForCurrentGroupRole;
    }

    var ctxDeletePrefVerdict = false;
    var prefValueArray = appCtxSvc.getCtx( 'preferences' ).Ac0DeleteDiscussionGroupRole;
    for( var i = 0; i < prefValueArray.length; i++ ) {
        var delDiscGroupRole = prefValueArray[i];
        var groupVal = delDiscGroupRole.split( '/' )[0];
        var roleVal = delDiscGroupRole.split( '/' )[1];
        if( appCtxSvc.getCtx( 'userSession' ).props.group_name.dbValue === groupVal
                      && appCtxSvc.getCtx( 'userSession' ).props.role_name.dbValue === roleVal ) {
            ctxDeletePrefVerdict = true;
            break;
        }
    }

    convCtx.deleteCommandValidForCurrentGroupRole = ctxDeletePrefVerdict;
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );

    return ctxDeletePrefVerdict;
};

/**
 * Method that modifies conversations before display.
 * @param {*} vmData view model data that contains conversation search results
 */
export let modifyConversations = function( vmData, discussionsLoadedState ) {
    var deferred = AwPromiseService.instance.defer();
    const discussionSearchResults = _.clone( vmData.searchResults );
    const discussionsLoadedStateNew = _.clone( discussionsLoadedState );
    var ctxDeletePrefVerdict = deleteCommandValidForCurrentGroupRole();
    var commentPromiseArray = [];
    if( discussionSearchResults.length === 0 ) {
        deferred.resolve( {} );
        return deferred.promise;
    }
    for( var ii = 0; ii < discussionSearchResults.length; ii++ ) {
        discussionSearchResults[ii].chipData = {
            chipType: 'BUTTON',
            labelDisplayName: '',
            labelInternalName: '',
            objUid: ''
        };

        var plainText = discussionSearchResults[ii].props.plainText ? discussionSearchResults[ii].props.plainText.displayValues[0] : '';
        var richText = discussionSearchResults[ii].props.richText ? discussionSearchResults[ii].props.richText.displayValues[0] : '';
        var sanitizedRichTxt = sanitizer.sanitizeHtmlValue( richText );
        richText = sanitizedRichTxt;
        if( typeof vmData.searchResults[ii].props.richText !== 'undefined' ) {
            vmData.searchResults[ii].props.richText.displayValues[0] = richText;
        }
        commentPromiseArray.push( prepareCommentCellViewModelObject( discussionSearchResults[ii], plainText, richText, ii, vmData ) );
    }
    Promise.all( commentPromiseArray ).then( ( values ) => {
        for( var ii = 0; ii < values.length; ii++ ) {
            discussionSearchResults[ii].isRootComment = true;

            var replyLinkString = '';
            var replyNums = discussionSearchResults[ii].props.numReplies ? discussionSearchResults[ii].props.numReplies.dbValue : '0';
            if( replyNums === 1 ) {
                replyLinkString = replyNums + ' ' + vmData.i18n.reply;
            }else {
                replyLinkString = replyNums + ' ' + vmData.i18n.replies;
            }

            discussionSearchResults[ii].followConvLink = uwPropSvc.createViewModelProperty( 'followConv', vmData.i18n.follow, 'STRING', 'follow' );
            discussionSearchResults[ii].doFollowConv = function( dpItem ) {
                //teardown when comments are collapsed - make cursorStartIndx undefined
                if( dpItem.showFollowConv ) { //if show follow is true, then we need to follow
                    ac0NotySvc.collabSubscribeToConversation( dpItem ).then( function( responseData ) {
                        dpItem.showFollowConv = !dpItem.showFollowConv;
                    } );
                }else {
                    ac0NotySvc.collabUnSubscribeToConversation( dpItem ).then( function( responseData ) {
                        dpItem.showFollowConv = !dpItem.showFollowConv;
                    } );
                }
            };
            discussionSearchResults[ ii ].isConvActionable = Boolean( vmData.searchResults[ ii ].props.convStatus && discussionSearchResults[ ii ].props.convStatus.dbValue !== '' );
            discussionSearchResults[ ii ].convStatusModifiable = discussionSearchResults[ ii ].isConvActionable && checkIfLoggedInUserIsParticipant( discussionSearchResults[ ii ] );
            discussionSearchResults[ii].unfollowConvLink = uwPropSvc.createViewModelProperty( 'unfollowConv', vmData.i18n.unfollow, 'STRING', 'unfollow' );
            discussionSearchResults[ii].showFollowConv = !vmData.searchResults[ii].props.isConvNotificationSubscribed.dbValue;
            discussionSearchResults[ii].showDeleteLink = ctxDeletePrefVerdict;
            //discussionSearchResults[ii].showDeleteLink = true;
            if ( discussionSearchResults[ ii ].props.collabRelatedObjectInfo ) {
                discussionSearchResults[ ii ].discussionHasSnapshot = Boolean( vmData.searchResults[ ii ].props.collabRelatedObjectInfo.dbValue.length > 0 );
                discussionSearchResults[ ii ].convViewSnapshotPerm = vmData.searchResults[ ii ].discussionHasSnapshot && checkIfLoggedInUserIsParticipant( vmData.searchResults[ ii ] );
            }
            discussionSearchResults[ii].deleteConvLink = uwPropSvc.createViewModelProperty( 'deleteConv', vmData.i18n.delete, 'STRING', 'delete' );
            discussionSearchResults[ii].doDeleteConv = function( dpItem ) {
                eventBus.publish( 'Ac0.initiateDeleteConversationEvent', dpItem );
            };
            //more commands command
            discussionSearchResults[ii].showMoreCellCmds = true;
            discussionSearchResults[ii].moreCellCmdsIdRef = 'collabMoreCellCmds_' + ii;
            // discussionSearchResults[ii].doShowMoreCmds = function( dpItem ) {
            var ac0ConvCtx = convUtils.getAc0ConvCtx();
            if( typeof ac0ConvCtx.convDP === 'undefined' ) {
                ac0ConvCtx.convDP = vmData.dataProviders.conversationDataProvider;
                appCtxSvc.registerCtx( 'Ac0ConvCtx', ac0ConvCtx );
            }
            // };
            setupMoreCmtCellCmdInfo( discussionSearchResults[ii], ii, true );
            setupCmtEditLink( discussionSearchResults[ii], vmData, ii );
            discussionSearchResults[ii].moreDesc = {
                extendedTooltipContent: vmData.i18n.more
            };
            discussionSearchResults[ii].followConvDesc = {
                extendedTooltipContent: vmData.i18n.followConvDesc
            };
            discussionSearchResults[ii].unFollowConvDesc = {
                extendedTooltipContent: vmData.i18n.unFollowConvDesc
            };
            discussionSearchResults[ii].rootCommentObj = createRootCommentVMO( discussionSearchResults[ii].props );
            discussionSearchResults[ii].showConvCellCmds = false;
            discussionSearchResults[ii].latestCommentDetails = {};
            discussionSearchResults[ii].latestCommentDetails.hasThumbnail = discussionSearchResults[ii].haslatestCommentThumbnail;
            discussionSearchResults[ii].latestCommentDetails.thumbnailUrl = discussionSearchResults[ii].latestCommentthumbnailUrl;
            discussionSearchResults[ii].latestCommentDetails.props = {};
            discussionSearchResults[ii].latestCommentDetails.props.userName = discussionSearchResults[ii].props.latestCommentuserName;
            if( discussionSearchResults[ii].latestCommentDetails.props.userName ) {
                discussionSearchResults[ii].latestCommentDetails.props.userName.displayValues[0] = discussionSearchResults[ii].props.latestCommentuserName.displayValues[0].split( '(' )[0].trim();
            }
            discussionSearchResults[ii].latestCommentDetails.props.userId = discussionSearchResults[ii].props.latestCommentuserId;
            discussionSearchResults[ii].latestCommentDetails.props.modifiedDateTime = discussionSearchResults[ii].props.latestCommentmodifiedDateTime;
            discussionSearchResults[ii].latestCommentDetails.props.plainText = discussionSearchResults[ii].props.latestCommentplainText;
            discussionSearchResults[ii].latestCommentDetails.props.richText = discussionSearchResults[ii].props.latestCommentrichText;
            discussionSearchResults[ii].latestCommentDetails.props.richTextObject = discussionSearchResults[ii].props.latestCommentrichTextObject;
            discussionSearchResults[ii].latestCommentDetails.props.rootCommentUID = discussionSearchResults[ii].props.latestCommentrootCommentUID;
            discussionSearchResults[ii].latestCommentDetails.showMore = discussionSearchResults[ii].showMoreLC;
            discussionSearchResults[ii].latestCommentDetails.showMoreLink = discussionSearchResults[ii].showMoreLinkLC;
            discussionSearchResults[ii].latestCommentDetails.showLessLink = discussionSearchResults[ii].showLessLinkLC;
            discussionSearchResults[ii].latestCommentDetails.props.latestCommentautoMsgType = discussionSearchResults[ii].props.latestCommentautoMsgType;
            delete discussionSearchResults[ii].props.latestCommentautoMsgType;
        }

        if( discussionsLoadedStateNew ) {
            discussionsLoadedStateNew.isDataLoaded = true;
        }
        deferred.resolve( {
            searchResults: discussionSearchResults,
            discussionsLoadedState: discussionsLoadedStateNew
        } );
    } );
    return deferred.promise;
};

/**
 * Method that checks if logged in user is participant in given conversation
 * @param {*} convObj conversation vmo
 * @param {*} currentCommentCtx current comment context used to control reply box visibility
 */
export let checkIfLoggedInUserIsParticipant = function( convObj ) {
    var loggedInUserIsParticipant = false;
    var currentUserUid = appCtxSvc.getCtx( 'user' ).uid;
    var participantsArray = convObj.props.participantObjList.dbValue;

    if( participantsArray && participantsArray.length > 0 ) {
        for( var i = 0; i < participantsArray.length; i++ ) {
            var participant = participantsArray[ i ];
            if( participant && participant.uid === currentUserUid ) {
                loggedInUserIsParticipant = true;
                break;
            }
        }
    }
    return loggedInUserIsParticipant;
};

/**
 * Method that modifies comments within a conversation tile before display.
 * @param {*} vmData view model data
 * @param {*} currentCommentCtx current comment context used to control reply box visibility
 */
export let modifyComments = function( vmData ) {
    if( typeof vmData !== 'undefined' && typeof vmData.searchResults !== 'undefined' ) {
        for( var ii = 0; ii < vmData.searchResults.length; ii++ ) {
            var plainText = vmData.searchResults[ii].props.plainText ? vmData.searchResults[ii].props.plainText.displayValues[0] : null;
            var richText = vmData.searchResults[ii].props.richText ? vmData.searchResults[ii].props.richText.displayValues[0] : null;
            var sanitizedRichTxt = sanitizer.sanitizeHtmlValue( richText );
            richText = sanitizedRichTxt;
            if( typeof vmData.searchResults[ii].props.richText !== 'undefined' ) {
                vmData.searchResults[ii].props.richText.displayValues[0] = richText;
            }
            prepareCommentCellViewModelObject( vmData.searchResults[ii], plainText, richText, null, vmData );
            setupMoreCmtCellCmdInfo( vmData.searchResults[ii], ii, true );
            setupCmtEditLink( vmData.searchResults[ii], vmData, ii );
        }
    }
    vmData.commentsDataProviderNotCalled = false;
};

/**
 * Method that invokes post comment action once reply button is clicked. Does some post processing to update dp on the fly
 * @param {*} convObj conversation object
 * @param {*} vmData view model data
 * @returns {*} Promise
 */

export let replyBoxAction = function( discussionItem, cke, discussionData, searchState ) {
    var deferred = AwPromiseService.instance.defer();
    // if( typeof convObj.ckeInstance === 'undefined' ) {
    //     convObj.ckeInstance = vmData.ckeInstance;
    // }
    var ckeText = createConvSvc.getRichText( cke._instance );
    var respRichText;
    //if reply button is clicked without any text, return
    if( _.isNull( ckeText ) ) {
        deferred.resolve( {} );
        return deferred.promise;
    }
    var policyDef = {
        types: [  {
            name: 'Ac0Comment',
            properties: [ {
                name: 'awp0CellProperties'
            }, {
                name: 'ac0CreateDate'
            }, {
                name: 'ac0DateModified'
            }, {
                name: 'ac0RichText'
            } ]
        } ]
    };
    var policyId = policySvc.register( policyDef );
    createConvSvc.postComment( discussionItem, ckeText ).then( function( responseData ) {
    //createConvSvc.postComment( discussionItem, ckeText, undefined, vmData ).then( function( responseData ) {
        if( policyId ) {
            policySvc.unregister( policyId );
        }
        const newCommentsReplyObj = { ...discussionData.getValue() };
        var vms = newCommentsReplyObj.loadedCommentsObject.loadedComments;
        var svmo = {
            props: {
                richText: '',
                plainText: '',
                modifiedDateTime: ''
            }
        };
        svmo.uid = 'temp888OBJ144';
        svmo.type = 'Ac0Comment';
        var newCommentObj = vmoSvc.constructViewModelObject( svmo );
        newCommentObj.props.plainText = {};
        newCommentObj.props.plainText.displayValues = [];
        newCommentObj.props.richText = {};
        newCommentObj.props.richText.displayValues = [];
        newCommentObj.props.modifiedDateTime = {};
        newCommentObj.props.modifiedDateTime.displayValues = [];
        newCommentObj.props.modifiedDateTime.dbValues = '';
        newCommentObj.props.plainText.displayValues.push( createConvSvc.getPlainText( cke ) );
        //Handle the response when creating
        if( responseData && !_.isEmpty( responseData.data.createComment )
        && !_.isEmpty( responseData.data.createComment.createdOrUpdatedCollabObject ) &&
        responseData.data.createComment.createdOrUpdatedCollabObject.collabPlainText &&
        responseData.data.createComment.createdOrUpdatedCollabObject.collabPlainText.length > 0 ) {
            newCommentObj.props.modifiedDateTime.displayValues.push( responseData.data.createComment.createdOrUpdatedCollabObject.collabDateModified );
            newCommentObj.props.modifiedDateTime.dbValues = responseData.data.createComment.createdOrUpdatedCollabObject.collabDateModified;
            respRichText = responseData.data.createComment.createdOrUpdatedCollabObject.collabRichText;
            newCommentObj.props.richText.displayValues.push( responseData.data.createComment.createdOrUpdatedCollabObject.collabRichText );
            newCommentObj.uid = responseData.data.createComment.createdOrUpdatedCollabObject.uid;
            newCommentObj.type = responseData.data.createComment.createdOrUpdatedCollabObject.type;
        }

        //Handle the response when updating
        if( responseData && !_.isEmpty( responseData.data.updateComment )
        && !_.isEmpty( responseData.data.updateComment.createdOrUpdatedCollabObject ) &&
        responseData.data.updateComment.createdOrUpdatedCollabObject.collabPlainText &&
        responseData.data.updateComment.createdOrUpdatedCollabObject.collabPlainText.length > 0 ) {
            newCommentObj.props.modifiedDateTime.displayValues.push( responseData.data.updateComment.createdOrUpdatedCollabObject.collabDateModified );
            newCommentObj.props.modifiedDateTime.dbValues = responseData.data.updateComment.createdOrUpdatedCollabObject.collabDateModified;
            respRichText = responseData.data.updateComment.createdOrUpdatedCollabObject.collabRichText;
            newCommentObj.props.richText.displayValues.push( responseData.data.updateComment.createdOrUpdatedCollabObject.collabRichText );
            newCommentObj.uid = responseData.data.updateComment.createdOrUpdatedCollabObject.uid;
            newCommentObj.type = responseData.data.updateComment.createdOrUpdatedCollabObject.type;
        }
        var tempVMData = {
            i18n: {
                more: 'More',
                less: 'Less'
            }
        };
        prepareCommentCellViewModelObject( newCommentObj, null, respRichText, null, tempVMData );
        setupMoreCmtCellCmdInfo( newCommentObj, null, false );
        setupCmtEditLink( newCommentObj );

        var currentUserObj = appCtxSvc.getCtx( 'user' );
        newCommentObj.props.userName = {
            displayValues: [ '' ]
        };
        newCommentObj.hasThumbnail = false;
        newCommentObj.thumbnailUrl = '';

        if( currentUserObj.props && currentUserObj.props.user_name ) {
            newCommentObj.props.userName.displayValues[0] = currentUserObj.props.user_name.dbValue;
        }

        if( currentUserObj.thumbnailURL ) {
            newCommentObj.hasThumbnail = true;
            newCommentObj.thumbnailUrl = currentUserObj.thumbnailURL;
        }
        vms.push( newCommentObj );
        //newCommentsReplyObj.loadedCommentsObject.loadedComments.push( vms );
        discussionData.update( newCommentsReplyObj );
        // const newReplyStrObj = { ...replyStrObj.value };
        // newReplyStrObj.repliesString = vms.length === 1 ? vms.length + ' ' + i18n.reply : vms.length + ' ' + i18n.replies;
        // replyStrObj.update && replyStrObj.update( newReplyStrObj );
        discussionItem.props.numReplies.dbValue++;
        createConvSvc.setCkEditorData( '', cke );
        if( searchState ) {
            convUtils.updateLatestCommentInPWA( searchState, discussionData );
        }
        deferred.resolve( responseData );
    } );
    //Reset PWA on reply in discussion location to refresh PWA and to move discussion to top of list
    if( convUtils.isDiscussionSublocation() ) {
        eventBus.publish( 'primaryWorkarea.reset' );
    }
    return deferred.promise;
};

export let loadMoreAction = function( vmData, convObj ) {
    if( !vmData.loadMoreComments ) {
        vmData.loadMoreComments = true;
    }
    vmData.hideMoreRepliesButton = true;

    //paging necessary
    var nextStartIndex = convObj.cursorStartIndx - vmData.dataProviders.commentsDataProvider.action.inputData.request.variables.searchInput.maxToLoad;
    //last page scenario - set endIndex to startIndex and startIndex to 0
    if( nextStartIndex <= 0 ) {
        convObj.cursorEndIndx = convObj.cursorStartIndx;
        convObj.cursorStartIndx = 0;
        return;
    }
    convObj.cursorStartIndx = nextStartIndex;
    convObj.cursorEndIndx = convObj.props.numReplies.dbValue;
};

export let initUniversalConvPanel = function( data, panelContext ) {
    var convCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' ) || {};
    convCtx.cmtEdit = {};
    convCtx.isIE = false;
    convCtx.createCollabObjData = {};
    //check to see if browser is IE
    if( browserUtils.isIE ) {
        convCtx.isIE = true;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    var newUniversalData = {};
    var newSharedData = {};
    if( typeof data !== 'undefined' && typeof data.universalData !== 'undefined' ) {
        newUniversalData = _.clone( data.universalData );
    }

    if( typeof data !== 'undefined' && typeof data.newSharedData !== 'undefined' ) {
        newSharedData = _.clone( data.sharedData );
    }
    newSharedData.addedSourceObjects = [];
    newSharedData.addedUserObjects = [];
    newSharedData.ckeText = '';
    newSharedData.trackedStatus = '';
    newSharedData.activeView = 'Ac0CreateNewCollabObj';

    if( panelContext && panelContext.currentSelectedSnapshot ) {
        newSharedData.currentSelectedSnapshot = panelContext.currentSelectedSnapshot;
    }
    //set the selected obj (for Awb0Element it will be the underlying object) in Ac0ConvCtx
    if( !convUtils.isDiscussionSublocation() && !newSharedData.currentSelectedSnapshot || !convUtils.isDiscussionSublocation() && newSharedData.currentSelectedSnapshot && convCtx.snapMode && convCtx.snapMode === 'open' ) {
        convUtils.setSelectedObjectInContext( data );
        if( newSharedData.currentSelectedSnapshot ) {
            newUniversalData.selectedObj = newSharedData.currentSelectedSnapshot;
        } else{
            newUniversalData.selectedObj = appCtxSvc.getCtx( 'Ac0ConvCtx.selected' );
        }
        newSharedData.activeView = 'Ac0UnivConvPanelSub';
    }
    if ( convUtils.isMyGallerySublocation() && convCtx.snapMode && convCtx.snapMode === 'create' ) {
        data.subPanelContext.selectionData.selected[0].cellHeader1 = null;
    }

    // We need to handle the use case where the 'panel' was opened in the
    // 'hosted' location used by NX.  In this case there is not a 'selected'
    // object in the universalData as there is no selected object in the UI
    // The selected object is in the URL
    if( typeof newUniversalData.selectedObj === 'undefined' || newUniversalData.selectedObj === null ) {
        const stateParams = AwStateService.instance.params;
        // lets get the VMobject
        var deferred = AwPromiseService.instance.defer();
        if( typeof stateParams !== 'undefined' && typeof stateParams.uid !== 'undefined' ) {
            const objectUIDArray = [];
            objectUIDArray.push( stateParams.uid );
            return dms.loadObjects( objectUIDArray ).then( function() {
                var relatedObj = cdm.getObject( stateParams.uid );
                newUniversalData.selectedObj = viewModelObjectSvc.createViewModelObject( relatedObj );
                var selectedArrayTmp = [ newUniversalData.selectedObj ];
                var selectedValueTmp = { value: selectionDataTmp };
                var selectionDataTmp = {
                    selected: selectedArrayTmp,
                    value: selectedValueTmp
                };
                var subPanelContextTmp = {
                    selectionData: selectionDataTmp
                };
                data.subPanelContext = subPanelContextTmp;
                convUtils.setSelectedObjectInContext( data );
                appCtxSvc.updateCtx( 'selected', newUniversalData.selectedObj );
                return {
                    universalData: newUniversalData,
                    sharedData: newSharedData
                };
            } );
        }
        deferred.resolve( {} );
    }

    return {
        universalData: newUniversalData,
        sharedData: newSharedData
    };
};

//TODO - this method should be tied to the unMount lifecyclehook. Currently it is being called on navigateBack which is detrimental. Hence not being called now.

export let destroyUniversalConvPanel = function() {
    appCtxSvc.unRegisterCtx( 'Ac0ConvCtx' );
};


/**
 * Add given sub panel
 * @param {String} destPanelId Panel ID
 * @param {String} titleLabel Title
 * @param {Object} data vmData
 */
export let addSubPanelPage = function( destPanelId, titleLabel, data ) {
    var ac0ConvCtx = convUtils.getAc0ConvCtx();
    ac0ConvCtx.createOrEditRichText = createConvSvc.getRichText( data.ckeInstance );
    ac0ConvCtx.invokingPanel = data.activeView;
    createConvSvc.destroyCkEditorInstance( data );
    appCtxSvc.registerCtx( 'Ac0ConvCtx', ac0ConvCtx );
    var context = {
        destPanelId: destPanelId,
        supportGoBack: true,
        title: titleLabel,
        recreatePanel: true,
        isolateMode: true
    };
    eventBus.publish( 'awPanel.navigate', context );
};

/**
 * set data to the parentData
 * @param {Object} data Data
 */
export let setParentData = function( data ) {
    // store create converation panel data to a variable.
    parentData = data;
};

export let getRandObjId = function() {
    var randObjId = '';
    randObjId += Math.floor( 10000 * Math.random() );
    return randObjId;
};

export let getParentData = function() {
    return parentData;
};


export let teardownUniversalConvPanel = function() {
    //empty out selected conversation
    selectedConv = {};
    createConvSvc.unSubscribeFromCkeEvents();
    var convCtx = convUtils.getAc0ConvCtx();
    if( convCtx.editConvCtx ) {
        var elementId = convCtx.editConvCtx.ckEditorIdRef;
        var domEditableElement = document.querySelector( '#' + elementId );
        domEditableElement.ckeditorInstance.disableReadOnlyMode( '#' + elementId );
        delete convCtx.editConvCtx;
    }
    if( convCtx.currentSelectedSnapshot ) {
        unregisterSnapshotDiscussionContextdata();
    }
};

export let conversationSelectionChange = function( event, vmData ) {
    var convCtx = convUtils.getAc0ConvCtx();
    if( event.selectedObjects.length === 1 ) {
        if( !_.isEmpty( selectedConv ) ) {
            selectedConv.showConvCellCmds = false;
        }
        selectedConv = event.selectedObjects[0];
        selectedConv.showConvCellCmds = true;

        convCtx.currentSelectedConversation = selectedConv;
        appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );

        eventBus.publish( 'Ac0Conversation.checkConvSubscriptionEvent' );
    }
    if( event.selectedObjects.length === 0 && !_.isEmpty( selectedConv ) ) {
        selectedConv.showConvCellCmds = false;
        convCtx.currentSelectedConversation = null;
        appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    }
};

export let setObjectDisplayData = function( data ) {
    convUtils.setObjectDisplayData( data );
};
export let destroyActiveCellCkeEditor = function() {
    var ac0ConvCtx = convUtils.getAc0ConvCtx();
    //not unsub from cke imgupload events here as the replyBox cke instance is still alive
    if( ac0ConvCtx.activeCell && ac0ConvCtx.activeCell.ckeInstance ) {
        ac0ConvCtx.activeCell.ckeInstance.cke._instance.destroy();
        ac0ConvCtx.activeCell.ckeInstance = null;
        appCtxSvc.registerCtx( 'Ac0ConvCtx', ac0ConvCtx );
    }
};

/**
 * Method that updates the Conversation cell in feedList secondary workarea
 * This is to handle context for chip and other link rendering in secondary workarea
 * @param {*} eventData event
 * @param {*} vmData view model data
 * @param {*} context
 */
var updateCoversationCell = function( vmData, eventData, ctx ) {
    var vms = null;
    if( typeof vmData !== 'undefined' && typeof vmData.data !== 'undefined' && typeof vmData.data.eventMap !== 'undefined' ) {
        var selectionChangeEventObj = vmData.data.eventMap[ 'primaryWorkArea.selectionChangeEvent' ];
        if( typeof selectionChangeEventObj !== 'undefined' &&  selectionChangeEventObj !== null ) {
            var selection = selectionChangeEventObj.selectedObjects[ 0 ];
            if( typeof selection !== 'undefined' && selection !== null ) {
                vms = selection;
            }
        }
    }

    if( vms === null ) {
        vms = ctx.selected;
    }

    var newConvObj = _.cloneDeep( vms );
    newConvObj.srcObjIdRef = 'ac0_' + vms.srcObjIdRef;
    ctx.newConvObj = newConvObj;
    appCtxSvc.registerCtx( 'newConvObj', newConvObj );
};


/**
 * Method that handles selection change updates, publishes selection chenge event
 * @param {*} eventData event
 * @param {*} vmData view model data
 * @param {*} context
 */
export let feedPrimaryWorkspaceSelection = function( vmData, eventData, ctx ) {
    if ( ctx.selected !== null ) {
        updateCoversationCell( vmData, eventData, ctx );
        //eventBus.publish( 'ac0activeCollaboration.selectionChangeEvent', eventData, ctx );
    }
};

/**
 * Method that invokes updateConversation graphql mutator to update conversation status.
 * @param {*} data view model data
 * @returns {*} Promise
 */
export let updateConvStatusAction = function( data, props ) {
    var convItemTobeUpdated = data.eventData.property.propInternalValue.slice( data.eventData.property.propInternalValue.indexOf( '_' ) + 1 );
    if( convItemTobeUpdated && convItemTobeUpdated === props.metaData.details.uid ) {
        var deferred = AwPromiseService.instance.defer();
        var convTileObj;
        if ( convUtils.isDiscussionSublocation() ) {
            convTileObj = appCtxSvc.getCtx( 'selected' );
        } else if( props && typeof props.metaData.details !== undefined ) {
            convTileObj = props.metaData.details;
        }

        var graphQLInput = {};

        // prepare source objects
        var sourceObjs = [];
        var sourceTags = convTileObj.props.inflatedSrcObjList;
        if( sourceTags ) {
            for( var i = 0; i < sourceTags.length; i++ ) {
                if( sourceTags[ i ] ) {
                    var srcObj = {
                        uid: sourceTags[ i ].uid,
                        type: sourceTags[ i ].type
                    };
                    sourceObjs.push( srcObj );
                }
            }
        }
        graphQLInput.sourceObjects = sourceObjs;

        // prepare participants
        var userObjs = [];
        var userTags = convTileObj.props.inflatedParticipantObjList;
        if( userTags ) {
            for( var i = 0; i < userTags.length; i++ ) {
                if( userTags[ i ] ) {
                    var usrObj = {
                        uid: userTags[ i ].uid,
                        type: userTags[ i ].type
                    };
                    userObjs.push( usrObj );
                }
            }
        }
        graphQLInput.listOfParticipants = userObjs;

        graphQLInput.defaultCommentText = convTileObj.props.richText.dbValues;
        graphQLInput.conversation = {
            type: 'Ac0Conversation',
            uid: convTileObj.props.collabUid.dbValues
        };
        graphQLInput.convPrivate = convTileObj.props.isConvPrivate.dbValues;
        if( convUtils.isAc0EnableTrackedDiscussions ) {
            graphQLInput.convActionable = convTileObj.isConvActionable;
            graphQLInput.status = convTileObj.isConvActionable ? data.eventData.property.dbValue.propDisplayValue : null;
            graphQLInput.priority = convTileObj.isConvActionable ? convTileObj.props.convPriority.dbValues : null;
            graphQLInput.closingUserId = convTileObj.isConvActionable ? appCtxSvc.getCtx( 'user' ).uid : null;
            graphQLInput.dateClosed = convTileObj.isConvActionable ? dateTimeSvc.formatUTC( new Date() ) : null;
        }

        var graphQLQuery = {
            endPoint: 'graphql',
            request: {
                query: 'mutation updateConversation($updateConversationInput: AddOrUpdateConversationInput!) { updateConversation(updateConversationInput: $updateConversationInput) { createdOrUpdatedCollabObject { uid type } } }',
                variables: {
                    updateConversationInput: graphQLInput
                }
            }
        };

        graphQLSvc.callGraphQL( graphQLQuery ).then( ( response ) => {
            if( !declUtils.isNil( response ) ) {
                let err = null;
                if( response.errors ) {
                    err = soaSvc.createError( response.errors[ 0 ] );
                }
                if( err ) {
                    var msg = '';
                    msg = msg.concat( data.i18n.convUpdateErrorMsg );
                    msgSvc.showError( msg );
                    deferred.reject( err );
                } else {
                    convTileObj.props.collabStatus.dbValue = data.eventData.property.dbValue.propDisplayValue;
                    convTileObj.props.convStatus.dbValue = data.eventData.property.dbValue.propDisplayValue;
                    if( props.sharedDataObj.sharedData ) {
                        let sharedDataValue = { ...props.sharedDataObj.sharedData.getValue() };
                        if( sharedDataValue && sharedDataValue.trackedStatus ) {
                            sharedDataValue.trackedStatus = data.eventData.property.dbValue.propDisplayValue;
                            props.sharedDataObj.sharedData.update( sharedDataValue );
                        }
                    }
                    deferred.resolve( response );
                }
            }
        }, ( err ) => {
            deferred.reject( err );
        } );

        if( convUtils.isDiscussionSublocation() ) {
            eventBus.publish( 'primaryWorkarea.reset' );
        }
        return deferred.promise;
    }
};

export let unregisterSnapshotDiscussionContextdata = function() {
    var convoCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' );
    convoCtx.selected = [];
    delete convoCtx.currentSelectedSnapshot;
    delete convoCtx.snapshotEntryPoint;
    delete convoCtx.snapMode;
    delete convoCtx.snapshotObjfnd0Roots;
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convoCtx );
};

// Small helper function to ensure the ctx.newConvObj is populated correctly
let ensureCtxNewConvObjIsPopulated = function( tmpCurDiscussionObj, vmObj, vmo ) {
    if( typeof tmpCurDiscussionObj !== 'undefined' && tmpCurDiscussionObj !== null && tmpCurDiscussionObj.uid === vmObj.uid ) {
        if( typeof tmpCurDiscussionObj.props.inflatedRelatedObjList === 'undefined' ) {
            tmpCurDiscussionObj.props.inflatedRelatedObjList = [];
        }
        if( !tmpCurDiscussionObj.props.inflatedRelatedObjList.some( tmpObj => tmpObj.uid === vmo.uid ) ) {
            // This object is not in the list add it
            tmpCurDiscussionObj.props.inflatedRelatedObjList.push( vmo );
        } else {
            // This object is in the list replace it with the provided one
            var foundIndex = tmpCurDiscussionObj.props.inflatedRelatedObjList.findIndex( tmpObj => tmpObj.uid === vmo.uid );
            tmpCurDiscussionObj.props.inflatedRelatedObjList[foundIndex] = vmo;
        }
    }
};

// Function to get the correct data for inflating RelatedObjectInfos
export let getInflatedRelatedObjectList = function( vmData ) {
    var promiseArray = [];
    if( typeof vmData !== 'undefined' && typeof vmData.searchResults !== 'undefined' ) {
        for( var j = 0; j < vmData.searchResults.length; j++ ) {
            var vmObject = vmData.searchResults[j];
            var collabRelatedObjectInfoUids = [];
            vmObject.props.inflatedRelatedObjList = [];
            for( var ii = 0; ii < vmObject.props.collabRelatedObjectInfo.dbValues.length; ii++ ) {
                collabRelatedObjectInfoUids.push( vmObject.props.collabRelatedObjectInfo.dbValues[ii].uid );
                // Resolving timing issue where the ui dataprovider is expecting info before it is populated.
                // put something in the inflatedRelatedObjList this will be overwritten in when processing the promise
                vmObject.props.inflatedRelatedObjList.push( {
                    uid:vmObject.props.collabRelatedObjectInfo.dbValues[ii].uid,
                    type: vmObject.props.collabRelatedObjectInfo.dbValues[ii].type
                } );
            }
            if( collabRelatedObjectInfoUids.length > 0 ) {
                vmObject.props.collabRelatedObjectInfoUids = collabRelatedObjectInfoUids;
                promiseArray.push( dms.loadObjects( collabRelatedObjectInfoUids ) );
            }
        }

        return Promise.all( promiseArray ).then( function() {
            var tmpCurDiscObj = appCtxSvc.getCtx( 'newConvObj' );
            for( var index = 0; index < vmData.searchResults.length; index++ ) {
                var vmObj = vmData.searchResults[index];
                vmObj.props.inflatedRelatedObjList = [];
                var relatedObjUids = [];
                for( var ii = 0; ii < vmObj.props.collabRelatedObjectInfo.dbValues.length; ii++ ) {
                    relatedObjUids.push( vmObj.props.collabRelatedObjectInfo.dbValues[ii].uid );
                }
                var totalNoOfobj = relatedObjUids.length;
                for( var nn = 0; nn < totalNoOfobj; nn++ ) { //total no. of participants to be visible initially
                    var relatedObj = cdm.getObject( relatedObjUids[nn] );
                    let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( relatedObj );
                    //TODO: temp code of disable inline edit of snapshot , need to revisit( check handleTextEditClick())
                    vmo.props.fnd0OwningIdentifier = vmo.modelType.propertyDescriptorsMap.fnd0OwningIdentifier;
                    vmObj.props.inflatedRelatedObjList.push( vmo );
                    vmObj.props.collabRelatedObjectInfo.dbValue[nn] = vmo;
                    vmObj.props.collabRelatedObjectInfo.dbValues[nn] = vmo;

                    // There is an issue where the 'newConvObj' object
                    // (which is a clone of this object) does not have its
                    // inflatedRelatedObjList value populated correctly at all times
                    // ensure that it is populated here
                    ensureCtxNewConvObjIsPopulated( tmpCurDiscObj, vmObj, vmo );
                }
            }
        } );
    }
};

/**
 * Ac0ConversationService factory
 */

export default exports = {
    feedLocationReveal,
    removeSrcChipObj,
    removeUserChipObj,
    onObjectTabSelectionChange,
    modifyConversations,
    replyBoxAction,
    modifyComments,
    loadMoreAction,
    initUniversalConvPanel,
    destroyUniversalConvPanel,
    addSubPanelPage,
    setParentData,
    getSourceObjects,
    getRandObjId,
    getParentData,
    getUserObjects,
    teardownUniversalConvPanel,
    conversationSelectionChange,
    setObjectDisplayData,
    destroyActiveCellCkeEditor,
    feedPrimaryWorkspaceSelection,
    updateConvStatusAction,
    deleteCommandValidForCurrentGroupRole,
    getInflatedSourceObjectList,
    unregisterSnapshotDiscussionContextdata,
    initMoreSourceObjPopup,
    initMoreParticipantPopup,
    getInflatedRelatedObjectList
};
