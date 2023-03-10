// Copyright (c) 2022 Siemens

/* global CKEDITOR */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ac0CreateCollabObjectService
 */
import { getBaseUrlPath } from 'app';
import ac0CkeditorService from 'js/Ac0CkeditorService';
import notyService from 'js/NotyModule';
import eventBus from 'js/eventBus';
import messageSvc from 'js/messagingService';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import Ac0CkeditorConfigProvider from 'js/Ac0CkeditorConfigProvider';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import $ from 'jquery';
import vmoSvc from 'js/viewModelObjectService';
import AwPromiseService from 'js/awPromiseService';
import ac0ConvSvc from 'js/Ac0ConversationService';
import listBoxService from 'js/listBoxService';
import ehFactory from 'js/editHandlerFactory';
import dataSourceService from 'js/dataSourceService';
import ehSvc from 'js/editHandlerService';
import graphQLSvc from 'js/graphQLService';
import soaSvc from 'soa/kernel/soaService';
import declUtils from 'js/declUtils';
import dateTimeSvc from 'js/dateTimeService';
import msgSvc from 'js/messagingService';
import convUtils from 'js/Ac0ConversationUtils';
import AwHttpService from 'js/awHttpService';
import constSvc from 'js/awConstantsService';
import ac0DissTileSvc from 'js/Ac0DiscussionTileService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import sanitizer from 'js/sanitizer';
import AwStateService from 'js/awStateService';


var exports = {};
var _isTextValid = false;
//var eventInsertImageInCKEditor = null;
var insertImageCKEEvents = [];
var defaultStatusInternalNameDispNameMap = new Map();
var defaultPriorityInternalNameDispNameMap = new Map();

/**
 * Get file URL from ticket.
 *
 * @param {String} ticket - File ticket.
 * @return file URL
 */

var _getFileURL = function( ticket ) {
    if( ticket ) {
        return browserUtils.getBaseURL() + 'fms/fmsdownload/' + fmsUtils.getFilenameFromTicket( ticket ) +
            '?ticket=' + ticket;
    }
    return null;
};

/**
 * Populate the object from the provided soa return
 * @param {*} soaMap map defined for soa
 * @returns {Object} jsObject
 */
var constructSrcObjUsrJSObj = function( soaMap ) {
    var jsObjFromSoaMap = {};
    if( !soaMap || soaMap[ 0 ].length <= 0 || soaMap[ 1 ].length <= 0 || soaMap[ 0 ].length !== soaMap[ 1 ].length ) {
        return jsObjFromSoaMap;
    }
    for( var ii = 0; ii < soaMap[ 0 ].length; ii++ ) {
        jsObjFromSoaMap[ soaMap[ 0 ][ ii ].uid ] = soaMap[ 1 ][ ii ];
    }
    return jsObjFromSoaMap;
};

export let showRichTextEditor = function( data, ckEditorDomId, insertImgEvtStr, ckeText ) {
    var deferred = AwPromiseService.instance.defer();
    var deferredSoa = AwPromiseService.instance.defer();
    var deferredFms = AwPromiseService.instance.defer();
    var config = new Ac0CkeditorConfigProvider();

    ac0CkeditorService.create( ckEditorDomId, config, insertImgEvtStr ).then( cke => {
        //ckeditor = cke;
        cke._instance.eventBus = eventBus;
        cke._instance.getBaseURL = browserUtils.getBaseURL();
        cke._instance.getBaseUrlPath = getBaseUrlPath();

        $( '.ck-body-wrapper' ).addClass( 'aw-layout-popup' );

        checkCKEInputTextValidityAndPublishEvent( cke, ckEditorDomId );

        cke.on( 'change', function() {
            checkCKEInputTextValidityAndPublishEvent( cke, ckEditorDomId );
        } );
        cke.on( 'notificationShow', function( evt ) {
            notyService.showInfo( evt.data.notification.message );
            evt.cancel();
        } );
        // Insert Image Event

        data.ckeInstance = cke._instance;

        var eventInsertImageInCKEditor = eventBus.subscribe( insertImgEvtStr,
            function( eventData ) {
                var fileName = 'fakepath\\' + eventData.file.name;

                data.form = eventData.form;

                var datasetInfo = {
                    clientId: eventData.clientid,
                    namedReferenceName: 'Image',
                    fileName: fileName,
                    name: eventData.clientid,
                    type: 'Image'
                };

                data.datasetInfo = datasetInfo;
                var fileMgmtInput = {};
                fileMgmtInput.transientFileInfos = [ {
                    fileName: datasetInfo.fileName,
                    isBinary: true,
                    deleteFlag: false
                } ];

                //eventBus.publish( 'ac0CreateDiss.InsertObjInCKEditor' );
                soaSvc.postUnchecked( 'Core-2007-01-FileManagement', 'getTransientFileTicketsForUpload', fileMgmtInput ).then(
                    function( responseData ) {
                        var fmsTicket = responseData.transientFileTicketInfos[ 0 ].ticket;
                        data.fmsTicket = fmsTicket;
                        updateFormData( {
                            key: 'fmsTicket',
                            value: fmsTicket
                        }, data );
                        var fmsinputData = {
                            request: {
                                method: 'POST',
                                url: constSvc.getConstant( 'fmsUrl' ),
                                headers: {
                                    'Content-type': undefined
                                },
                                data: data.formData
                            }
                        };
                        AwHttpService.instance( fmsinputData.request ).then( function( response ) {
                            insertImage( data );
                        }, function( err ) {
                            deferredFms.reject( err );
                        } );
                        deferredSoa.resolve( responseData );
                    },
                    function( reason ) {
                        deferredSoa.reject( reason );
                    } );
            } );
        insertImageCKEEvents.push( eventInsertImageInCKEditor );
        var ac0ConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' );
        ac0ConvCtx.createCollabObjData.ckeInstance = cke;
        appCtxSvc.registerCtx( 'Ac0ConvCtx', ac0ConvCtx );
        if( data.previousView && data.previousView === 'ProductSnapshotEditSub' ) {
            ckeText = ac0ConvCtx.ckEditorRename;
            const sharedDataValue = { ...data.value };
            delete sharedDataValue.previousView;
            delete ac0ConvCtx.ckEditorRename;
            data.update && data.update( sharedDataValue );
        }
        setCkEditorData( ckeText, cke );
        const newCkeInstance = _.clone( data.ckeInstance );
        newCkeInstance.cke = cke;
        deferred.resolve( newCkeInstance );
    } );
    return deferred.promise;
};

/**
 * set FullText object of Requirement Revision
 *
 * @param {Object} data - The panel's view model object
 *
 */
export let insertImage = function( data ) {
    var ckeInstance = data.ckeInstance;
    if( data.fmsTicket ) {
        var imageURL = _getFileURL( data.fmsTicket );
        const content = '<img src="' + imageURL + '"/>';
        if( ckeInstance.data ) {
            const viewFragment = ckeInstance.data.processor.toView( content );
            const modelFragment = ckeInstance.data.toModel( viewFragment );
            ckeInstance.model.insertContent( modelFragment );
        } else {
            var imgHtml = CKEDITOR.dom.element.createFromHtml( content );
            ckeInstance.insertElement( imgHtml );
        }
    }
};

/**
 * update data for fileData
 *
 * @param {Object} fileData - key string value the location of the file
 * @param {Object} data - the view model data object
 */
export let updateFormData = function( fileData, data ) {
    if( fileData && fileData.value ) {
        var form = data.form;
        data.formData = new FormData( $( form )[ 0 ] );
        data.formData.append( fileData.key, fileData.value );
    }
};

/**
 * Returns rich text
 * @param {Object} ckeInstance ckeInstance
 * @return {String} richtext richText
 */
export let getRichText = function( ckeInstance ) {
    var _richTextCK = ckeInstance.getData();
    var sanitizedRichTxt = sanitizer.sanitizeHtmlValue( _richTextCK );
    var _richText = sanitizedRichTxt;
    if( _richText.includes( '<img' ) ) {
        if( !_richText.includes( 'style=\"width:100%\"' ) ) {
            if( browserUtils.isIE ) {
                _richText = _richText.replace( /<(\s*)img(.*?)\s*\/>/g, '<$1img$2 style=\"width:100%\"/>' );
                _richText = _richText.replace( /<(\s*)img(.*?)\/\/\s*>/g, '<$1img$2></img>' );
                _richText = _richText.replace( /<(\s*)img(.*?)\/\s*>/g, '<$1img$2></img>' );
            } else {
                _richText = _richText.replace( /<(\s*)img(.*?)\s*>/g, '<$1img$2 style=\"width:100%\"/>' );
                _richText = _richText.replace( /<(\s*)img(.*?)\/\/\s*>/g, '<$1img$2></img>' );
                _richText = _richText.replace( /<(\s*)img(.*?)\/\s*>/g, '<$1img$2></img>' );
            }
        }
    }
    return _richText;
};

/**
 * Returns plain text
 * @param {Object} ckeInstance ckeInstance
 * @return {Object} text string
 */
export let getPlainText = function( ckeInstance ) {
    return ckeInstance.getText();
};

export let setIsTextValid = function( valid ) {
    _isTextValid = valid;
    eventBus.publish( 'isInputTextValidEvent', null );
};

/**
 * Sets variable with whether text was entered. Called by action and value is used by condition to set visibility of
 * post button.
 * @param {String} data vmdata
 * @param {Boolean} isInputTextValidVal is input text valid
 */
export let isInputTextValid = function( data, isInputTextValidVal, ckEditorType, sharedData ) {
    var convCtx = convUtils.getAc0ConvCtx();
    if( ckEditorType === 'replyEditor' ||  convCtx.cmtEdit && convCtx.cmtEdit.activeCommentToEdit &&
        convCtx.cmtEdit.activeCommentToEdit.beingEdited === false ) {
        if( data.ckeInstance && data.ckeInstance.cke && getPlainText( data.ckeInstance.cke ) !== '' ) {
            convCtx.ckEditorRef = 'replyEditor';
            if( sharedData ) {
                const newSharedData = { ...sharedData.value };
                sharedData.update && sharedData.update( newSharedData );
            }
        }
    } else if( ckEditorType === 'saveDiscardEditor' ) {
        convCtx.ckEditorRef = 'saveDiscardEditor';
        if( sharedData ) {
            const newSharedData = { ...sharedData.value };
            sharedData.update && sharedData.update( newSharedData );
        }
    } else{
        convCtx.ckEditorRef = '';
    }
    if( convUtils.isDiscussionSublocation() ) {
        convCtx.isInputTextValid = isInputTextValidVal;
        return convCtx.isInputTextValid;
    }
    var newIsInputTextValid = _.clone( data.isInputTextValid );
    newIsInputTextValid = isInputTextValidVal;

    return newIsInputTextValid;
};

export let checkCKEInputTextValidityAndPublishEvent = function( cke, ckEditorRef ) {
    var theData = cke.getData().replace( /&nbsp;/g, '' );
    theData = theData.replace( /<p>( )*<\/p>/g, '' );
    if( theData.trim() !== '' ) {
        _isTextValid = true;
    } else {
        _isTextValid = false;
    }
    var ckeditorType = '';
    if( ckEditorRef && ckEditorRef.includes( 'cmtReply' ) ) {
        ckeditorType = 'replyEditor';
    } else if( ckEditorRef && ckEditorRef.includes( 'collabCmtEdit' ) ) {
        ckeditorType = 'saveDiscardEditor';
    }
    eventBus.publish( 'isInputTextValidEvent', { isTextValid: _isTextValid, ckeditorTypeEvent: ckeditorType } );
};
/**
 * Populate the data structure used to display which participant/source obj
 * combination do not have read access.
 */
export let warnParticipantSourceNoReadAccess = function() {
    var convCtx = convUtils.getAc0ConvCtx();

    var participantSourceMap = constructSrcObjUsrJSObj( convCtx.userObjectMap );
    var participantNames = [];
    var sourceObjNames = [];

    _.forEach( Object.keys( participantSourceMap ), function( participantUid ) {
        var part = cdm.getObject( participantUid ).props.object_string.dbValues[ 0 ].split( '(' )[ 0 ].trim();
        var sourceObjName = '';
        for( var ii = 0; ii < participantSourceMap[ participantUid ].length; ii++ ) {
            sourceObjName += cdm.getObject( participantSourceMap[ participantUid ][ ii ].uid ).props.object_string.dbValues[ 0 ];
            sourceObjName += ', ';
        }
        sourceObjName = sourceObjName.slice( 0, -2 );
        sourceObjNames.push( sourceObjName );
        participantNames.push( part );
    } );

    convCtx.warnMsgText = '';
    for( var jj = 0; jj < participantNames.length; jj++ ) {
        convCtx.warnMsgText += messageSvc.applyMessageParamsWithoutContext( convCtx.i18nindividualReadAccessWarnDesc, [ participantNames[ jj ], sourceObjNames[ jj ] ] );
        convCtx.warnMsgText += '\n';
    }
    convCtx.warnMsgText.trim();
    if( participantNames.length > 0 && sourceObjNames.length > 0 ) {
        convCtx.showWarnMsg = true;
    } else {
        convCtx.showWarnMsg = false;
    }
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    return { showUserWarnMessageVal: convCtx.showWarnMsg };
};

// var addLoggedInUserToUserChips = ( userChipsObj, newUserChipsObj, loggedInUserChips, editConvCtx ) => {
//     var chipExisted = _.find( userChipsObj.userChips, function( chip ) {
//         if ( typeof loggedInUserChips === 'undefined' || typeof loggedInUserChips[0].theObject !== 'undefined' ) {
//             return chip.theObject.uid === loggedInUserChips[0].theObject.uid;
//         }
//         return undefined;
//     } );
//     if ( !chipExisted && !editConvCtx ) {
//         if ( !userChipsObj.userChips ) {
//             newUserChipsObj.userChips = [];
//         }
//         newUserChipsObj.userChips.push( loggedInUserChips[0] );
//     }
// };

export let changeConvType = function( convType, userChipsObj, loggedInUserChips, sharedData ) {
    var editConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' ).editConvCtx;
    const newConvType = _.clone( convType );
    const newUserChipsObj = _.clone( userChipsObj );
    if( convType && convType.dbValue === '' ) {
        newConvType.dbValue = 'message';
        const newSharedData = { ...sharedData.value };
        newSharedData.isPrivate = true;
        newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, loggedInUserChips );
        if( !editConvCtx ) {
            _.forEach( newSharedData.addedUserObjects, ( userChipObj ) => {
                if( userChipObj.theObject.uid === appCtxSvc.getCtx( 'user' ).uid ) {
                    userChipObj.enableWhen = { condition: 'conditions.falsyCondition' };
                }
            } );
        }
        newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        sharedData.update && sharedData.update( newSharedData );
        // addLoggedInUserToUserChips( userChipsObj, newUserChipsObj, loggedInUserChips, editConvCtx );
    } else if( convType && convType.dbValue === 'message' ) {
        newConvType.dbValue = '';
        const newSharedData = { ...sharedData.value };
        newSharedData.isPrivate = false;
        newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, loggedInUserChips );
        _.forEach( newSharedData.addedUserObjects, ( userChipObj ) => {
            if( userChipObj.theObject.uid === appCtxSvc.getCtx( 'user' ).uid ) {
                userChipObj.enableWhen = { condition: 'conditions.truthyCondition' };
            }
        } );
        newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        sharedData.update && sharedData.update( newSharedData );
    }
    if( editConvCtx ) {
        editConvCtx.props.isConvPrivate.dbValue = newConvType.dbValue === 'message';
    }
    return {
        convType: newConvType,
        userChipsObj: newUserChipsObj
    };
};

export let changeConvActionable = function( convActionable, priority, status, userChipsObj, loggedInUserChips, sharedData ) {
    var editConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' ).editConvCtx;
    const newConvActionable = _.clone( convActionable );
    const newPriority = _.clone( priority );
    const newStatus = _.clone( status );
    const newUserChipsObj = _.clone( userChipsObj );

    if( convActionable && convActionable.dbValue === '' ) {
        newConvActionable.dbValue = 'actionable';
        setPriorityAndStatusValues( newPriority, newStatus, 'Low', 'Open' );
        const newSharedData = { ...sharedData.value };
        newSharedData.isTracked = true;
        newSharedData.trackedPriority = newPriority.dbValue;
        newSharedData.trackedStatus = newStatus.dbValue;
        newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, loggedInUserChips );
        newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        sharedData.update && sharedData.update( newSharedData );
    } else if( convActionable && convActionable.dbValue === 'actionable' ) {
        newConvActionable.dbValue = '';
        newStatus.dbValue = '';
        newPriority.dbValue = '';
        const newSharedData = { ...sharedData.value };
        newSharedData.isTracked = false;
        newSharedData.trackedPriority = '';
        newSharedData.trackedStatus = '';
        sharedData.update && sharedData.update( newSharedData );
    }
    if( editConvCtx ) {
        editConvCtx.props.convStatus.dbValue = newStatus.dbValue;
        editConvCtx.props.convPriority.dbValue = newPriority.dbValue;
    }
    return {
        convActionable: newConvActionable,
        userChipsObj: newUserChipsObj,
        priority: newPriority,
        status: newStatus
    };
};

export let setPriorityAndStatusValues = ( newPriority, newStatus, priorityVal, statusVal, sharedData ) => {
    newPriority.dbValue = priorityVal;
    newPriority.uiValue = defaultPriorityInternalNameDispNameMap.get( priorityVal );
    newStatus.dbValue = statusVal;
    newStatus.uiValue = defaultStatusInternalNameDispNameMap.get( statusVal );
    if( sharedData && sharedData.value.isTracked ) {
        const newSharedData = { ...sharedData.value };
        //newSharedData.isTracked = true;
        newSharedData.trackedPriority = newPriority.dbValue;
        newSharedData.trackedStatus = newStatus.dbValue;
        sharedData.update && sharedData.update( newSharedData );
    }
};

let ensureSrcObjChipsPopulatedInEmbededUsecase = function( data ) {
    var srcObjChips = data.srcObjChips;
    if( typeof srcObjChips !== 'undefined' && srcObjChips.length > 0 && srcObjChips[0].labelInternalName === '' ) {
        if( typeof data.ctx.selected !== 'undefined' && data.ctx.selected !== null ) {
            if( typeof data.ctx.selected.cellHeader1 !== 'undefined' && data.ctx.selected.cellHeader1 !== null  ) {
                srcObjChips[0].labelDisplayName = data.ctx.selected.cellHeader1;
                srcObjChips[0].labelInternalName = data.ctx.selected.cellHeader1;
                srcObjChips[0].theObject = data.ctx.selected;
            } else {
                srcObjChips[0].labelDisplayName = data.ctx.selected.props.object_string.uiValues[0];
                srcObjChips[0].labelInternalName = data.ctx.selected.props.object_string.uiValues[0];
                srcObjChips[0].theObject = data.ctx.selected;
            }
        } else {
            // Lets find this from the url????
            const stateParams = AwStateService.instance.params;
            const objectUid = stateParams.uid;
            var selObj = cdm.getObject( objectUid );
            srcObjChips[0].labelDisplayName = selObj.cellHeader1;
            srcObjChips[0].labelInternalName = selObj.cellHeader1;
            srcObjChips[0].theObject = selObj;
        }
    }
};

export let initCreateCollabObjectPanel = function( data, sharedData ) {
    var editConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' ).editConvCtx;
    const newConvTypeCheck = _.clone( data.convTypeChk );
    const newConvType = _.clone( data.convType );
    const newConvActionableChk = _.clone( data.convActionableChk );
    const newConvActionable = _.clone( data.convActionable );
    const newPriority = _.clone( data.priority );
    const newStatus = _.clone( data.status );
    const newUserChipsObj = _.clone( data.userChipsObj );
    const newSharedData = { ...sharedData.value };

    var srcObjList = [];
    var participantList = {};

    //populating vm data with sharedData objects. This use case comes into play only on coming back from Add source obj or user panel.
    //sharedData.addedUserObjects or sharedData.addedSourceObjects should be populated as chips here only on coming back from these panels.
    //For all other usecases ( initial edit and initial create ) these will be empty.
    if( !convUtils.isDiscussionSublocation() ) {
        ensureSrcObjChipsPopulatedInEmbededUsecase( data );
    }
    addSourceObjectsToChipList( data.srcObjChips, sharedData.addedSourceObjects );
    newUserChipsObj.userChips = [ ...sharedData.addedUserObjects ];
    //addUserObjectsToChipList( newUserChipsObj.userChips, sharedData.addedUserObjects );
    if( sharedData.value.isTracked ) {
        newConvActionable.dbValue = 'actionable';
        newConvActionableChk.dbValue = true;
        setPriorityAndStatusValues( newPriority, newStatus, sharedData.value.trackedPriority, sharedData.value.trackedStatus );
        newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, null );
        newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
    }
    if( sharedData.value.isPrivate ) {
        newConvType.dbValue = 'message';
        newConvTypeCheck.dbValue = true;
        // addLoggedInUserToUserChips( data.userChipsObj, newUserChipsObj, data.loggedInUserChips, editConvCtx );
        newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, null );
        newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
    }

    if( editConvCtx ) {
        srcObjList = editConvCtx.props.sourceObjList.dbValues.map( function( srcObj ) {
            return {
                uid: srcObj.uid,
                props: {
                    object_string: {
                        dbValue: srcObj.object_string
                    }
                }
            };
        } );
        participantList = {
            selectedUsers: editConvCtx.props.participantObjList.dbValues.map( function( user ) {
                return {
                    uid: user.uid,
                    props: {
                        user_name: {
                            uiValue: user.object_string.split( '(' )[ 0 ].trim()
                        }
                    },
                    modelType: {
                        typeHierarchyArray: [ 'User' ]
                    }
                };
            } )
        };
    }
    initCreateCollabObjectPanelSub( data, sharedData, newUserChipsObj );
    if( editConvCtx ) {
        addSourceObjectsToChipList( data.srcObjChips, srcObjList );
        var userObjsToAdd = [];
        if( _.isEmpty( sharedData.addedUserObjects ) ) {
            userObjsToAdd = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, participantList.selectedUsers );
        } else {
            userObjsToAdd = sharedData.addedUserObjects;
        }
        newSharedData.addedUserObjects = [ ...userObjsToAdd ];
        newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        // addUserObjectsToChipList( newUserChipsObj.userChips, participantList.selectedUsers );
        if( editConvCtx.props.isConvPrivate.dbValue === true ) {
            newConvType.dbValue = 'message';
            newConvTypeCheck.dbValue = true;
            newSharedData.isPrivate = true;
            //sharedData.update && sharedData.update( newSharedData );
            //addLoggedInUserToUserChips( data.userChipsObj, newUserChipsObj, data.loggedInUserChips, editConvCtx );
            newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, null );
            newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        }
        if( editConvCtx.props.convStatus.dbValue !== '' && editConvCtx.props.convPriority.dbValue !== '' && convUtils.isAc0EnableTrackedDiscussions() ) {
            newConvActionable.dbValue = 'actionable';
            newConvActionableChk.dbValue = true;
            var priorityToSet = sharedData.value.trackedPriority ? sharedData.value.trackedPriority : editConvCtx.props.convPriority.dbValue;
            var statusToSet = sharedData.value.trackedStatus ? sharedData.value.trackedStatus : editConvCtx.props.convStatus.dbValue;
            setPriorityAndStatusValues( newPriority, newStatus, priorityToSet, statusToSet );
            newSharedData.isTracked = true;
            newSharedData.trackedPriority = newPriority.dbValue;
            newSharedData.trackedStatus = newStatus.dbValue;
            //sharedData.update && sharedData.update( newSharedData );
            // addLoggedInUserToUserChips( data.userChipsObj, newUserChipsObj, data.loggedInUserChips, editConvCtx );
            newSharedData.addedUserObjects = ac0DissTileSvc.convertUserObjectsToUniqueUserChipList( sharedData, null );
            newUserChipsObj.userChips = [ ...newSharedData.addedUserObjects ];
        }
        appCtxSvc.updateCtx( 'Ac0ConvCtx.createOrEditRichText', editConvCtx.props.richText.displayValues[ 0 ] );
        var ac0EditHandler = ehFactory.createEditHandler( dataSourceService.createNewDataSource( {
            declViewModel: data
        } ) );
        //ac0EditSvc.addEditHandler( ac0EditHandler );
        ehSvc.setEditHandler( ac0EditHandler, 'AC0_CONVERSATION' );
        newSharedData.addedSourceObjects = [ ...sharedData.value.addedSourceObjects, ...srcObjList ];
        // newSharedData.addedUserObjects = [ ...sharedData.value.addedUserObjects, ...participantList.selectedUsers ];
    }
    sharedData.update && sharedData.update( newSharedData );
    return {
        convTypeChk: newConvTypeCheck,
        convType: newConvType,
        convActionableChk: newConvActionableChk,
        convActionable: newConvActionable,
        priority: newPriority,
        status: newStatus,
        userChipsObj: newUserChipsObj
    };
};

var initCreateCollabObjectPanelSub = function( data, sharedData, newUserChipsObj ) {
    var convCtx = convUtils.getAc0ConvCtx();
    convCtx.collabDataProviders = data.dataProviders;
    convCtx.showWarnMsg = false;
    convCtx.warnMsgText = '';
    convCtx.createOrEditRichText = '';
    convCtx.i18nparticipantReadAccessWarningMsg = data.i18n.participantReadAccessWarningMsg;
    convCtx.i18nindividualReadAccessWarnDesc = data.i18n.individualReadAccessWarnDesc;
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
    // TODO - should this be deleted this was commented out previously.
    // var selObj = appCtxSvc.getCtx( 'Ac0ConvCtx.selected' );
    //data.selectedObj = selObj;
    if( data.userChips ) {
        delete data.userChips;
    }

    //modify the selected obj fnd0roots
    if ( convCtx.currentSelectedSnapshot ) {
        if( convCtx.snapshotEntryPoint ) {
            _.remove( data.srcObjChips, ( chip ) => {
                return chip.theObject.type === 'Fnd0Snapshot';
            } );
            // When initializing the panel from a snapshot we do not
            // need the selected object from the assembly to be added
            // unless the user specificaly adds it
            // The chips added by 'default' in this usecase do not have
            // the delete ('x') icon so they can be removed
            _.remove( data.srcObjChips, ( chip ) => {
                return typeof chip.uiIconId === 'undefined';
            } );
        }

        var srcObj = convCtx.currentSelectedSnapshot.props.fnd0Roots;
        // TODO - confirm this can be removed
        // What is this check inteded to look for?
        //if( typeof srcObj !== 'undefined' && convCtx.snapshotObjfnd0Roots ) {
        if( typeof srcObj !== 'undefined' ) {
            var chipObj = cdm.getObject( srcObj.dbValues[0] );
            let chipObjVMO = viewModelObjectSvc.createViewModelObject( chipObj );
            var srcObject = {
                // TODO - clean this up or should it be uncommented?
                // The 'root' source object should not be removable
                // uiIconId: 'miscRemoveBreadcrumb',
                chipType: 'BUTTON',
                labelDisplayName: chipObjVMO.cellHeader1,
                labelInternalName: chipObjVMO.props.object_string.dbValue,
                theObject: chipObjVMO
            };
            var chipExisted = _.find( data.srcObjChips, function( chip ) {
                return chip.theObject.uid === srcObject.uid;
            } );
            if( !chipExisted ) {
                data.srcObjChips.splice( 0, 0, srcObject );
            }
        }
    }
};

/**
 * Method that switches flags in the context.
 * @param {*} conv Conversation
 * @param {*} comment Comment
 */
export let modifyCreateCtxFlagsForCollabObjs = function( conv, comment ) {
    var convCtx = convUtils.getAc0ConvCtx();
    convCtx.createNewComment = comment;
    convCtx.createNewConversation = conv;
    appCtxSvc.registerCtx( 'Ac0ConvCtx', convCtx );
};

/**
 * Method that preps service input before posting a comment
 * @param {*} convObj conversation object
 * @param {*} richText rich text string
 * @returns {*} Promise
 */
export let postComment = function( convObj, richText, commentObj, data, removedRelatedObjList ) {
    var deferred = AwPromiseService.instance.defer();
    var graphQLInput = {};

    var contextConvObj = {};
    var convObjForSoa = {};

    if( convObj ) {
        contextConvObj = convObj;
    } else {
        contextConvObj.rootCommentObj = appCtxSvc.getCtx( 'Ac0ConvCtx' ).createCommentRootCommentObj;
        contextConvObj.uid = appCtxSvc.getCtx( 'Ac0ConvCtx' ).createCommentConvId;
    }

    convObjForSoa = cdm.getObject( contextConvObj.uid );
    if( !convObjForSoa ) {
        var svmo = {
            props: {}
        };
        svmo.uid = contextConvObj.uid;
        svmo.type = 'Ac0Conversation';
        convObjForSoa = vmoSvc.constructViewModelObject( svmo );
    }

    graphQLInput.richText = richText ? richText : getRichText( convObj.ckeInstance );
    graphQLInput.rootComment  = {
        uid: contextConvObj.rootCommentObj.uid
    };

    graphQLInput.conversation = {
        uid: convObjForSoa.uid,
        type: convObjForSoa.type
    };

    var relatedObjCopy  = [];
    if( contextConvObj.props && contextConvObj.props.collabRelatedObjectInfo ) {
        relatedObjCopy = [ ...contextConvObj.props.collabRelatedObjectInfo.dbValue ];
    }

    var graphQLQuery;
    if( typeof commentObj !== 'undefined' && commentObj !== null && typeof commentObj.uid !== 'undefined' ) {
        graphQLInput.comment = {
            type: 'Ac0Comment',
            uid: commentObj.isRootComment ? contextConvObj.rootCommentObj.uid : commentObj.uid //if root comment is being edited, then pass rootCommentObj uid. Else pass regular comment uid
        };

        if( removedRelatedObjList ) {
            graphQLInput.options = getRemovedRelatedObjectList( relatedObjCopy, removedRelatedObjList );
        }

        //edit comment
        graphQLQuery = {
            endPoint: 'graphql',
            request: {
                query: 'mutation updateComment($updateCommentInput: UpdateCommentInput!) { updateComment(updateCommentInput: $updateCommentInput) { createdOrUpdatedCollabObject { uid type collabRichText collabDateModified collabPlainText} } }',
                variables: {
                    updateCommentInput: graphQLInput
                }
            }
        };
        //Comment updated, publish event to refresh Discussion sublocation, to reset PWA data
        if( convUtils.isDiscussionSublocation() ) {
            eventBus.publish( 'primaryWorkarea.reset' );
        }
    } else {
        //create comment
        graphQLQuery = {
            endPoint: 'graphql',
            request: {
                query: 'mutation createComment($createCommentInput: CreateCommentInput!) { createComment(createCommentInput: $createCommentInput) { createdOrUpdatedCollabObject { uid type collabRichText collabDateModified collabPlainText} } }',
                variables: {
                    createCommentInput: graphQLInput
                }
            }
        };
    }

    graphQLSvc.callGraphQL( graphQLQuery ).then( ( response ) => {
        if ( !declUtils.isNil( response ) ) {
            //TODO: error handling will be corrected in followup CP. GQL schema for error is being worked upon.
            let err = null;
            if ( response.errors ) {
                err = soaSvc.createError( response.errors[0] );
            }
            if ( err && typeof  data !== 'undefined' ) {
                var msg = '';
                msg = msg.concat( data.i18n.commentCreationErrorMsg );
                msgSvc.showError( msg );
                deferred.reject( err );
            } else {
                deferred.resolve( response );
            }
        }
    }, ( err ) => {
        deferred.reject( err );
    } );
    return deferred.promise;
};

/**
 * Method that preps service input before posting a conversation
 * @param {*} data input data
 * @returns {*} Promise
 */
export let postConversation = function( data, sharedData ) {
    var deferred = AwPromiseService.instance.defer();
    var ckeInstance = appCtxSvc.getCtx( 'Ac0ConvCtx.createCollabObjData.ckeInstance' );
    var graphQLInput = {};

    var snapshotObj = appCtxSvc.getCtx( 'viewer.discussionCtx' ) ? appCtxSvc.getCtx( 'viewer.discussionCtx' ).newProductSnapshot : {};
    if ( sharedData && sharedData.currentSelectedSnapshot ) {
        snapshotObj = sharedData.currentSelectedSnapshot;
    }
    const payloadOptions = {};
    payloadOptions.snapshotObjUid = snapshotObj ? snapshotObj.uid : null;

    graphQLInput.sourceObjects = [];
    graphQLInput.sourceObjects = ac0ConvSvc.getSourceObjects( data );
    graphQLInput.listOfParticipants = ac0ConvSvc.getUserObjects( data );
    graphQLInput.defaultCommentText = getRichText( ckeInstance );
    graphQLInput.options = getDiscussionOptions( payloadOptions ); //{"snapshot", "snaphotUID"}
    graphQLInput.conversation = data.editConvUid ? {
        type: 'Ac0Conversation',
        uid: data.editConvUid
    } : {
        type: 'Ac0Conversation',
        uid: 'AAAAAAAAAAAAAA'
    };
    graphQLInput.convPrivate = data.convType.dbValue === 'message';
    graphQLInput.convActionable = data.convActionable.dbValue === 'actionable';
    if ( convUtils.isAc0EnableTrackedDiscussions() ) {
        graphQLInput.status = data.convActionable.dbValue === 'actionable' ? data.status.dbValue : null;
        graphQLInput.priority = data.convActionable.dbValue === 'actionable' ? data.priority.dbValue : null;
        graphQLInput.closingUserId = data.convActionable.dbValue === 'actionable' ? data.statusChangedByUserId : null;
        graphQLInput.dateClosed = data.convActionable.dbValue === 'actionable' ? dateTimeSvc.formatUTC( new Date() ) : null;
    }

    var graphQLQuery;
    var editConvCtx = appCtxSvc.getCtx( 'Ac0ConvCtx' ).editConvCtx;
    if( editConvCtx ) { //edit conversation
        graphQLQuery = {
            endPoint: 'graphql',
            request: {
                query: 'mutation updateConversation($updateConversationInput: AddOrUpdateConversationInput!) { updateConversation(updateConversationInput: $updateConversationInput) { createdOrUpdatedCollabObject { uid type } } }',
                variables: {
                    updateConversationInput: graphQLInput
                }
            }
        };
    } else { //create conversation
        graphQLQuery = {
            endPoint: 'graphql',
            request: {
                query: 'mutation addConversation($addConversationInput: AddOrUpdateConversationInput!) { addConversation(addConversationInput: $addConversationInput) { createdOrUpdatedCollabObject { uid type } } }',
                variables: {
                    addConversationInput: graphQLInput
                }
            }
        };
    }

    graphQLSvc.callGraphQL( graphQLQuery ).then( ( response ) => {
        if( !declUtils.isNil( response ) ) {
            //TODO: error handling will be corrected in followup CP. GQL schema for error is being worked upon.
            modifyCreateCtxFlagsForCollabObjs( false, false );
            let err = null;
            if( response.errors ) {
                err = soaSvc.createError( response.errors[ 0 ] );
            }
            if( err ) {
                var msg = '';
                msg = msg.concat( data.i18n.convCreationErrorMsg );
                msgSvc.showError( msg );
                if( !convUtils.isDiscussionSublocation() ) {
                    ac0DissTileSvc.navigateToDiscussionsPanel( sharedData );
                }
                deferred.reject( err );
            } else {
                deferred.resolve( response );
            }
        }
    }, ( err ) => {
        deferred.reject( err );
    } );
    return deferred.promise;
};

export let destroyCkEditorInstance = function( data ) {
    if( data.ckeInstance ) {
        unSubscribeFromCkeEvents();
        data.ckeInstance.destroy();
    }
    data.ckeInstance = null;
};

export let unSubscribeFromCkeEvents = function() {
    if( insertImageCKEEvents && insertImageCKEEvents.length > 0 ) {
        _.forEach( insertImageCKEEvents, function( insertImageEvt ) {
            eventBus.unsubscribe( insertImageEvt );
        } );
        insertImageCKEEvents = [];
    }
};

export let setCkEditorData = function( data, ckeInstance ) {
    var text = data ? data : '';
    if( ckeInstance && ckeInstance.cke && ckeInstance.cke._instance ) {
        ckeInstance.cke._instance.setData( text );
    }
    if( ckeInstance._instance ) {
        ckeInstance._instance.setData( text );
    }
};

export let evalNavPathPriorToCKEDecision = function( data ) {
    if( data.eventData && data.eventData.destPanelId === 'Ac0UnivConvPanelSub' ) {
        destroyCkEditorInstance( data );
    }
    if( data.eventData && data.eventData.destPanelId === 'Ac0CreateNewCollabObj' ) {
        eventBus.publish( 'Ac0CreateCollabObj.evalNavCompleteCreateCKE' );
    }
};

/**
 * Process Status LOV Values.
 *
 * @param {Object} response The soa response
 */
export let processStatusLOV = function( response, data, metaData ) {
    var internalValues = [];
    var values = [];
    for( var i = 0; i < response.lovValues.length; i++ ) {
        internalValues[ i ] = response.lovValues[ i ].propInternalValues.lov_values[ 0 ];
        values[ i ] = response.lovValues[ i ].propDisplayValues.lov_values[ 0 ];
    }

    var listOfValues = listBoxService.createListModelObjectsFromStrings( values );
    for( var j = 0; j < internalValues.length; j++ ) {
        if( metaData ) {
            listOfValues[ j ].propInternalValue = internalValues[ j ] + '_' + metaData.uid;
        } else{
            listOfValues[ j ].propInternalValue = internalValues[ j ];
        }
        listOfValues[ j ].propDisplayValue = values[ j ];
        defaultStatusInternalNameDispNameMap.set( internalValues[ j ], values[ j ] );
    }
    return listOfValues;
};

/**
 * Process Priority LOV Values.
 *
 * @param {Object} response The soa response
 */
export let processPriorityLOV = function( response, data ) {
    var internalValues = [];
    var values = [];
    for( var i = 0; i < response.lovValues.length; i++ ) {
        internalValues[ i ] = response.lovValues[ i ].propInternalValues.lov_values[ 0 ];
        values[ i ] = response.lovValues[ i ].propDisplayValues.lov_values[ 0 ];
    }

    var listOfValues = listBoxService.createListModelObjectsFromStrings( values );
    for( var j = 0; j < internalValues.length; j++ ) {
        listOfValues[ j ].propInternalValue = internalValues[ j ];
        listOfValues[ j ].propDisplayValue = values[ j ];
        defaultPriorityInternalNameDispNameMap.set( internalValues[ j ], values[ j ] );
    }
    return listOfValues;
};

export let selectionChangeCreatePanel = function( data, sharedData ) {
    //TODO: wire in edithandler leaveConfirmation code here when ready
    var convCtx = convUtils.getAc0ConvCtx();
    if( !convCtx.editConvCtx ) {
        ac0DissTileSvc.navigateToDiscussionsPanel( sharedData );
        return;
    }
    if( convCtx.editConvCtx ) {
        convCtx.editConvCtx = null;
        var activeToolAndInfoCmd = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
        var buttons = [ {
            addClass: 'btn btn-notify',
            text: data.i18n.saveEditsGroupPWATitle,
            onClick: function( $noty ) {
                $noty.close();
                exports.postConversation( data ).then( function() {
                    ac0DissTileSvc.navigateToDiscussionsPanel( sharedData );
                    if( activeToolAndInfoCmd && activeToolAndInfoCmd.commandId ) {
                        eventBus.publish( 'awsidenav.openClose', {
                            id: 'aw_toolsAndInfo',
                            commandId: activeToolAndInfoCmd.commandId
                        } );
                    }
                } );
            }
        },
        {
            //Call soa if clicked on proceed
            addClass: 'btn btn-notify',
            text: data.i18n.discard,
            onClick: function( $noty ) {
                $noty.close();
                ac0DissTileSvc.navigateToDiscussionsPanel( sharedData );
                if( activeToolAndInfoCmd && activeToolAndInfoCmd.commandId ) {
                    eventBus.publish( 'awsidenav.openClose', {
                        id: 'aw_toolsAndInfo',
                        commandId: activeToolAndInfoCmd.commandId
                    } );
                }
            }
        }
        ];
        messageSvc.showWarning( data.i18n.possibleUnsavedEdits, buttons );
    }
};

export let updateSharedDataWithSourceObjects = function( sharedData, sourceObjects ) {
    const newSharedData = { ...sharedData.value };
    newSharedData.addedSourceObjects = [ ...sharedData.value.addedSourceObjects, ...sourceObjects ];
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

export let updateSharedDataWithUserObjects = function( sharedData, userObjects ) {
    const newSharedData = { ...sharedData.value };
    newSharedData.addedUserObjects = [ ...sharedData.value.addedUserObjects, ...userObjects ];
    sharedData.update && sharedData.update( newSharedData );
    return newSharedData;
};

/**
 * Add source objects from Pallette/Search to dataProvider
 * @param {Object} data Data
 */
export let addSourceObjectsToChipList = function( srcObjChips, addedSourceObjects ) {
    if( addedSourceObjects ) {
        for( var i = 0; i < addedSourceObjects.length; i++ ) {
            var srcObject = {
                uiIconId: 'miscRemoveBreadcrumb',
                chipType: 'BUTTON',
                labelDisplayName: addedSourceObjects[ i ].props.object_string.dbValue,
                labelInternalName: addedSourceObjects[ i ].props.object_string.dbValue,
                theObject: addedSourceObjects[ i ]
            };

            var chipExisted = _.find( srcObjChips, function( chip ) {
                //For Awb0DesignElement - theObject.uid is different and it needs special check to add only one chip.
                if( chip.theObject.props.awb0UnderlyingObject ) {
                    var awb0UndrlyngObjChipUid = chip.theObject.props.awb0UnderlyingObject.dbValues[0];
                }
                var addedSourceObjectsUid = addedSourceObjects[ i ].uid;
                if ( awb0UndrlyngObjChipUid ) {
                    return awb0UndrlyngObjChipUid === addedSourceObjectsUid;
                }
                return chip.theObject.uid === addedSourceObjectsUid;
            } );

            if( !chipExisted ) {
                srcObjChips.push( srcObject );
            }
        }

        _.remove( srcObjChips, ( chip ) => {
            return _.isEmpty( chip.labelDisplayName ) || _.isEmpty( chip.labelInternalName );
        } );
    }
};

/**
 * Add source objects from Pallette/Search to dataProvider
 * @param {Object} data Data
 */
export let addUserObjectsToChipList = function( userObjChips, addedUserObjects ) {
    if( addedUserObjects ) {
        for( var i = 0; i < addedUserObjects.length; i++ ) {
            var srcObject = {
                uiIconId: 'miscRemoveBreadcrumb',
                chipType: 'BUTTON',
                labelDisplayName: addedUserObjects[ i ].props.user_name.uiValue,
                labelInternalName: addedUserObjects[ i ].props.user_name.uiValue,
                theObject: addedUserObjects[ i ]
            };

            var chipExisted = _.find( userObjChips, function( chip ) {
                return chip.theObject.uid === addedUserObjects[ i ].uid;
            } );

            if( !chipExisted ) {
                userObjChips.push( srcObject );
            }
        }
    }
};

var getDiscussionOptions = function( data ) {
    if( typeof data.snapshotObjUid !== 'undefined' && data.snapshotObjUid !== null ) {
        return [ { key : 'Fnd0Snapshot', value : [ data.snapshotObjUid ] } ];
    }
    return null;
};

var getRemovedRelatedObjectList = function( relatedObjList, removedRelatedObjects ) {
    var removedRelatedObjUIDList = removedRelatedObjects.map( ( removedObj ) => { return removedObj.uid; } );
    var relatedObjAfterRemove = relatedObjList.reduce( ( acc, relatedObj ) => {
        if( acc.hasOwnProperty( relatedObj.type ) ) {
            if( !removedRelatedObjUIDList.includes( relatedObj.uid ) ) {
                if( acc[relatedObj.type].length === 0 ) {
                    acc[relatedObj.type] = [];
                }
                acc[relatedObj.type].push( relatedObj.uid );
            }
        }else {
            acc[relatedObj.type] = '';
            if( !removedRelatedObjUIDList.includes( relatedObj.uid ) ) {
                acc[relatedObj.type] = [ relatedObj.uid ];
            }
        }
        return acc;
    }, {} );
    return Object.keys( relatedObjAfterRemove ).map( ( relObjAfterRemoveKey ) => {
        return { key: relObjAfterRemoveKey, value: relatedObjAfterRemove[relObjAfterRemoveKey] };
    } );
};

export let closePanelOnSelectionChange = function() {
    if( convUtils.isMyGallerySublocation() ) {
        var activeToolAndInfoCmd = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
        if( activeToolAndInfoCmd && activeToolAndInfoCmd.commandId ) {
            eventBus.publish( 'awsidenav.openClose', {
                id: 'aw_toolsAndInfo',
                commandId: activeToolAndInfoCmd.commandId
            } );
        }
    }
};

/**
 * Ac0CreateCollabObjectService factory
 */

export default exports = {
    setIsTextValid,
    showRichTextEditor,
    updateFormData,
    insertImage,
    getRichText,
    getPlainText,
    isInputTextValid,
    warnParticipantSourceNoReadAccess,
    changeConvType,
    changeConvActionable,
    initCreateCollabObjectPanel,
    modifyCreateCtxFlagsForCollabObjs,
    postComment,
    postConversation,
    destroyCkEditorInstance,
    setCkEditorData,
    processStatusLOV,
    processPriorityLOV,
    selectionChangeCreatePanel,
    evalNavPathPriorToCKEDecision,
    unSubscribeFromCkeEvents,
    checkCKEInputTextValidityAndPublishEvent,
    updateSharedDataWithSourceObjects,
    addSourceObjectsToChipList,
    updateSharedDataWithUserObjects,
    closePanelOnSelectionChange,
    setPriorityAndStatusValues
};
