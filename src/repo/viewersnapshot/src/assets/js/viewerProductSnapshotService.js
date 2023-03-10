// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/viewerProductSnapshotService
 */
import appCtxSvc from 'js/appCtxService';
import messagingService from 'js/messagingService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import logger from 'js/logger';
import _cdmSvc from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import vmoSvc from 'js/viewModelObjectService';
import viewerCtxSvc from 'js/viewerContext.service';
import declUtils from 'js/declUtils';
import viewerPerformanceService from 'js/viewerPerformance.service';
import searchFilterSvc from 'js/aw.searchFilter.service';

var exports = {};

let snapshotPanelDataCtx = null;
const APP_SESSION_MANAGEMENT_SOA = 'Cad-2020-01-AppSessionManagement';
const CORE_DATA_MANAGEMENT_SOA = 'Core-2006-03-DataManagement';

/**
 * Snapshot panel revealed
 * @param {Object} panelContext panel context
 * @param {Object} snapshotPanelData snapshot atomic data
 * @returns {Object} vmo for product snapshot gallery
 */
export let productSnapshotPanelRevealed = function( panelContext, snapshotPanelData ) {
    let currentVMO = {};
    if( panelContext.occmgmtContext ) {
        currentVMO = vmoSvc.constructViewModelObjectFromModelObject( panelContext.occmgmtContext.topElement, 'Search' );
    }
    snapshotPanelDataCtx = snapshotPanelData;
    let viewerContextData = panelContext && panelContext.viewerContextData ? panelContext.viewerContextData : null;
    if( viewerContextData ) {
        viewerContextData.updateViewerAtomicData( 'activeCaptureGalleryTab', 'InputSnapshot' );
    }
    return {
        vmoForProductSnapshotGallery: currentVMO
    };
};

/**
 * Get file URL from ticket.
 * @param {String} ticket - File ticket.
 * @returns {String} fileURL file ticket
 */
export let getFileURLFromTicket = function( ticket ) {
    if( ticket ) {
        return browserUtils.getBaseURL() + 'fms/fmsdownload/' + fmsUtils.getFilenameFromTicket( ticket ) +
            '?ticket=' + encodeURIComponent( ticket );
    }
    return null;
};

/**
 * Creates Product Snapshots in Teamcenter
 *
 * @param  {Object} commandContext command context
 *
 * @returns {Object} snapshot
 */
export let createProductSnapshot = function( commandContext ) {
    commandContext.viewerContextData.getViewerAtomicDataSubject().notify( viewerCtxSvc.VIEWER_CAPTURE_SNAPSHOT_BEGIN );
    let snapshotObject = null;
    /**Currnetly, using getVisLicenseLevels API to check if visServer is Alive. Need to update this in future
     * if we get API to check if the visServer is connected or not.
     */
    let viewerView = commandContext.viewerContextData.getViewerView();
    return viewerView.getVisLicenseLevels( window.JSCom.Consts.LICENSE_LEVELS.ALL ).then( () => {
        return _createProductSnapshot( commandContext.occmgmtContext );
    } ).then( result => {
        snapshotObject = result;
        return commandContext.viewerContextData.getSessionMgr().updateProductSnapshot( snapshotObject.uid );
    } ).then( () => {
        return snapshotObject;
    } ).catch( ( error ) => {
        logger.error( 'ViewerSnapshotService: Create Product Snapshot failed: ' + error );
    } );
};

/**
 * Creates snapshots and fires notifictaion
 *
 * @param  {Object} data view model
 * @param  {Object} commandContext command context
 * @returns {Promise} return promise which on resolve returns snapshot object
 */
export let createProductSnapshotAndNotify = function( data, commandContext ) {
    if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
        viewerPerformanceService.setViewerPerformanceMode( true );
        viewerPerformanceService.startViewerPerformanceDataCapture( viewerPerformanceService.viewerPerformanceParameters.CaptureProductSnapshot );
    }
    return createProductSnapshot( commandContext ).then( function( snapshotModel ) {
        if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
            viewerPerformanceService.stopViewerPerformanceDataCapture( 'Product snapshot created : ' );
            viewerPerformanceService.setViewerPerformanceMode( false );
        }
        if( _.isNull( snapshotModel ) || _.isUndefined( snapshotModel ) ) {
            logger.error( 'ViewerSnapshotService: Create Product Snapshot failed:' );
            throw 'Create Product Snapshot failed';
        } else {
            let msg = data.i18n.captureProductSnapshotSuccess.replace( '{0}', snapshotModel.props.object_string.dbValues[ 0 ] );
            messagingService.showInfo( msg );
            _updateSnapshotList( commandContext.snapshotPanelData );
            return snapshotModel;
        }
    } ).catch( ( error ) => {
        logger.error( 'viewerProductSnapshotService: Product Snapshot get properties failed: ' + error );
    } );
};

/**
 * Creates snapshots and fires notifictaion On Discussion Panel
 * @param  {Object} data view model
 * @param  {Object} commandContext command context
 */
export let createProductSnapshotOnDiscussion = function( data, commandContext ) {
    let commandContextDiscussion = { ...commandContext, viewerContextData: _getViewerContextData( data.ctx ), occmgmtContext: data.ctx.occmgmtContext };
    exports.createProductSnapshotAndNotify( data, commandContextDiscussion ).then( function( snapshotModel ) {
        _updateThumbnailOnSnapshot( snapshotModel, commandContext.sharedData );
    } );
};

/**
 * Clear snapshot discussion data
 * @param {Object} sharedData shared atomic data of active collab panels
 */
export let clearSnapshotDiscussionData = function( sharedData ) {
    let sharedDataValue = { ...sharedData.getValue() };
    if( sharedDataValue && sharedDataValue.currentSelectedSnapshot ) {
        sharedDataValue.currentSelectedSnapshot = null;
        sharedDataValue.updateSnapshotOnDiscussion = !sharedDataValue.updateSnapshotOnDiscussion;
        sharedData.update( sharedDataValue );
    }
};

/**
 * Loads product snapshot data for snapshot section discussion panel
 * @param {Object} sharedData shared atomic data of active collab panels
 * @returns {Object} object containing list of snapshots and number of snapshots
 */
export let loadProductSnapshotDataForCard = function( sharedData ) {
    var selection = [];
    let sharedDataValue = sharedData.getValue();
    if( sharedDataValue && sharedDataValue.currentSelectedSnapshot ) {
        selection.push( sharedDataValue.currentSelectedSnapshot );
    }
    return {
        snapshotOnDiscussion: selection,
        snapshotTotalFound: selection.length
    };
};

/**
 * Updates selected product snapshot by capturing current viewer state on discussion Panel
 * @param  {Object} commandContext selected snapshot
 * @param  {Object} data view model
 */
export let updateProductSnapshotOnDiscussion = function( commandContext, data ) {
    _updateProductSnapshot( commandContext.vmo, _getViewerContextData( data.ctx ), data.ctx.occmgmtContext )
        .then( () => {
            _updateThumbnailOnSnapshot( commandContext.vmo, commandContext.sharedData );
        } ).catch( ( error ) => {
            messagingService.showInfo( data.i18n.failedToUpdate );
            logger.error( 'ViewerProductSnapshotService: Product Snapshot update failed: ' + error );
        } );
};

/**
 * Updates thumbnail on snapshot on discussion panel
 * @param {Object} vmo viewmodel object
 * @param {Object} sharedData shared atomic data of active collab panels
 */
let _updateThumbnailOnSnapshot = ( vmo, sharedData ) => {
    soaSvc.post( CORE_DATA_MANAGEMENT_SOA, 'getProperties', {
        objects: [ {
            uid: vmo.uid,
            type: 'Fnd0Snapshot'
        } ],
        attributes: [ 'awp0ThumbnailImageTicket' ]
    } ).then( function() {
        var snapImgVar = {};
        snapImgVar.fmsTicket = vmo.props.awp0ThumbnailImageTicket.dbValues[ 0 ];
        var imageURL = getFileURLFromTicket( snapImgVar.fmsTicket );
        let currentVMO = vmoSvc.constructViewModelObjectFromModelObject( vmo, 'Search' );
        let sharedDataValue = { ...sharedData.getValue() };
        sharedDataValue.currentSelectedSnapshot = currentVMO;
        sharedDataValue.currentSelectedSnapshot.thumbnailURL = imageURL;
        sharedDataValue.updateSnapshotOnDiscussion = !sharedDataValue.updateSnapshotOnDiscussion;
        sharedData.update( sharedDataValue );
    } );
};

/**
 * Delete the object from Teamcenter Database
 * @param {*} vmo selected view model
 * @param {*} data view model
 */
export let deleteProductSnapshotAndNotify = function( vmo, data ) {
    soaSvc.post( CORE_DATA_MANAGEMENT_SOA, 'deleteObjects', { objects: [ vmo ] } ).then( function() {
        let snapshotGallery = appCtxSvc.getCtx( 'mySnapshotGallery' );
        if( !_.isUndefined( snapshotGallery ) ) {
            eventBus.publish( 'primaryWorkarea.reset' );
        }
        messagingService.showInfo( data.i18n.productSnapshotDeletedSuccussfully );
    } ).catch( ( error ) => {
        var msg = data.i18n.productSnapshotDeleteFailed.replace( '{0}', error );
        messagingService.showError( msg );
        logger.error( 'viewerProductSnapshotService: Product Snapshot delete failed: ' + error );
    } );
};

/**
 * Deletes snapshot
 *
 * @param  {Object} vmo selected snapshot
 * @param  {Object} data view model
 */
export let deleteProductSnapshot = function( vmo, data ) {
    var msg = data.i18n.productSnapshotDeleteConfirmationText.replace( '{0}', vmo.cellHeader1 );
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: data.i18n.cancelText,
        onClick: function( $noty ) {
            $noty.close();
        }
    }, {
        addClass: 'btn btn-notify',
        text: data.i18n.deleteText,
        onClick: function( $noty ) {
            $noty.close();
            deleteProductSnapshotAndNotify( vmo, data );
        }
    } ];
    messagingService.showWarning( msg, buttons );
};

/**
 * Starts snapshot edit operation
 *
 * @param  {Object} commandContext command context
 * @param {Object} snapshotPanelData atomic data
 */
export let startEditProductSnapshot = function( commandContext, snapshotPanelData ) {
    let updatedsnapshotPanelData = { ...snapshotPanelData.getValue() };
    updatedsnapshotPanelData.activeView = 'ProductSnapshotEditSub';
    updatedsnapshotPanelData.snapshotBeingEdit = commandContext.vmo;
    snapshotPanelData.update( updatedsnapshotPanelData );
};

/**
 * Updates snapshot Name
 *
 * @param  {String} newName new name for snapshot
 * @param  {Object} data view model
 * @param {Object} snapshotPanelData snapshot panel data
 */
export let renameProductSnapshotAndNotify = function( newName, data, snapshotPanelData ) {
    var inputData = [ {
        object: snapshotPanelData.snapshotBeingEdit,
        vecNameVal: [ {
            name: 'object_name',
            values: [
                newName
            ]
        } ]
    } ];
    /* update the name in Teamcenter*/
    soaSvc.post( 'Core-2010-09-DataManagement', 'setProperties', { info: inputData } ).then( function() {
        messagingService.showInfo( data.i18n.updatedProductSnapshotSuccessfully );
        let activeToolsAndInfoCtx = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
        let updatedsnapshotPanelData = { ...snapshotPanelData.getValue() };
        if( activeToolsAndInfoCtx.commandId === 'Awv0CaptureGallery' ) {
            updatedsnapshotPanelData.activeView = 'ProductSnapshotListSub';
        } else if( activeToolsAndInfoCtx.commandId === 'Ac0UniversalConversationPanel' ) {
            updatedsnapshotPanelData.activeView = 'Ac0CreateNewCollabObj';
            updatedsnapshotPanelData.previousView = 'ProductSnapshotEditSub';
            if( snapshotPanelData.currentSelectedSnapshot ) {
                snapshotPanelData.currentSelectedSnapshot.cellHeader1 = newName;
            }
        }
        updatedsnapshotPanelData.snapshotBeingEdit = {};
        updatedsnapshotPanelData.renderTextbox = !updatedsnapshotPanelData.renderTextbox;
        snapshotPanelData.update( updatedsnapshotPanelData );
    } ).catch( ( error ) => {
        messagingService.showInfo( data.i18n.failedToUpdate );
        logger.error( 'ViewerSnapshotService: Product Snapshot rename failed: ' + error );
    } );
};

/**
 * Clear previous selection
 *  @param {Object} dataProvider snapshot DataProvider
 */
export let clearPreviousProductSnapshotSelection = function( dataProvider ) {
    var viewModelObject = dataProvider.selectedObjects;
    if( viewModelObject && viewModelObject.length > 0 && dataProvider.selectionModel ) {
        dataProvider.selectionModel.setSelection( [] );
    }
};

/**
 * Set snapshot view
 *
 * @param {Object} commandContext snapshot atomic data
 * @param {String} snapshotView View to set for snapshot panel
 */
export let setProductSnapshotView = function( commandContext, snapshotView ) {
    const updatedSnapshotPanelData = { ...commandContext.snapshotPanelData.getValue() };
    updatedSnapshotPanelData.updateSnapshotList = !updatedSnapshotPanelData.updateSnapshotList;
    updatedSnapshotPanelData.snapshotView = snapshotView;
    commandContext.snapshotPanelData.update( updatedSnapshotPanelData );
};

/**
 * Get the default page size used for max to load/return.
 * @param {Array|Object} defaultPageSizePreference - default page size from server preferences
 * @returns {Number} The amount of objects to return from a server SOA response.
 */
export let getDefaultPageSize = function( defaultPageSizePreference ) {
    var defaultPageSize = 50;

    if( defaultPageSizePreference ) {
        if( _.isArray( defaultPageSizePreference ) ) {
            defaultPageSize = exports.getDefaultPageSize( defaultPageSizePreference[ 0 ] );
        } else if( _.isString( defaultPageSizePreference ) ) {
            defaultPageSize = parseInt( defaultPageSizePreference );
        } else if( _.isNumber( defaultPageSizePreference ) && defaultPageSizePreference > 0 ) {
            defaultPageSize = defaultPageSizePreference;
        }
    }

    return defaultPageSize;
};

/**
 * Updates selected product snapshot by capturing current viewer state
 * @param  {Object} vmo selected snapshot
 * @param  {Object} data view model
 * @param {Object} snapshotPanelData snapshot atomic data
 * @returns {Promise} promise which gets resolved after updating snapshot
 */
export let updateProductSnapshotAndNotify = function( vmo, data, snapshotPanelData ) {
    let panelContext = data.ctx.panelContext;
    if( _.isUndefined( panelContext ) ) {
        return;
    }
    return _updateProductSnapshot( vmo, panelContext.viewerContextData, panelContext.occmgmtContext )
        .then( () => {
            _updateSnapshotList( snapshotPanelData );
        } ).catch( ( error ) => {
            messagingService.showInfo( data.i18n.failedToUpdate );
            logger.error( 'ViewerProductSnapshotService: Product Snapshot update failed: ' + error );
        } );
};

/**
 * Updates selected product snapshot by capturing current viewer state
 * @param  {Object} vmo selected snapshot
 * @param {Object} viewerContextData viewer context data
 * @param {Object} occmgmtContext occurence management context
 * @returns {Promise} resolves on successful update of snapshot
 */
let _updateProductSnapshot = ( vmo, viewerContextData, occmgmtContext ) => {
    let viewerView = viewerContextData.getViewerView();
    return viewerView.getVisLicenseLevels( window.JSCom.Consts.LICENSE_LEVELS.ALL )
        .then( () => {
            return _updateStructureInProductSnapshot( vmo, occmgmtContext );
        } ).then( () => {
            return viewerContextData.getSessionMgr().updateProductSnapshot( vmo.uid );
        } );
};

/**
 * create snapshot object from SOA
 *
 * @param  {Object} occmgmtCtx occurence management context
 * @returns {Object} snapshot object
 */
let _createProductSnapshot = function( occmgmtCtx ) {
    return declUtils.loadDependentModule( 'js/occmgmtBackingObjectProviderService' )
        .then( ( occMBOPSMod ) => {
            if( occMBOPSMod ) {
                return occMBOPSMod.getBackingObjects( [ occmgmtCtx.topElement ] );
            }
        } ).then( ( topLinesArray ) => {
            return soaSvc.post( APP_SESSION_MANAGEMENT_SOA, 'createOrUpdateSavedSession', {
                sessionsToCreateOrUpdate: [ {
                    sessionToCreateOrUpdate: {
                        objectToCreate: {
                            creInp: {
                                boName: 'Fnd0Snapshot'
                            }
                        }
                    },
                    productAndConfigsToCreate: [ {
                        structureRecipe: {
                            structureContextIdentifier: {
                                product: {
                                    uid: topLinesArray[ 0 ].uid
                                }
                            }
                        }
                    } ]
                } ]
            } );
        } ).then( createOutput => {
            return createOutput.sessionOutputs[ 0 ].sessionObject;
        } );
};

/**
 * Update structure in snapshot object from SOA
 * @param {Object} snapshotObject snapshot vmo
 * @param {Object} occmgmtContext occurence management context
 * @returns {Promise} promise which resolve on update of structure in snapshot
 */
let _updateStructureInProductSnapshot = function( snapshotObject, occmgmtContext ) {
    let topLinesArray = null;
    let snapshotObjModelObject = _cdmSvc.getObject( snapshotObject.uid );
    return declUtils.loadDependentModule( 'js/occmgmtBackingObjectProviderService' )
        .then( ( occMBOPSMod ) => {
            if( occMBOPSMod ) {
                return occMBOPSMod.getBackingObjects( [ occmgmtContext.topElement ] );
            }
        } ).then( ( topLinesArray1 ) => {
            topLinesArray = topLinesArray1;
            return soaSvc.post( APP_SESSION_MANAGEMENT_SOA, 'openSavedSession', {
                sessionsToOpen: [ snapshotObjModelObject ],
                filter: {
                    productStructureFilter: {
                        productStructure: 'RecipeObjectsOnly'
                    }
                }
            } );
        } ).then( ( result ) => {
            let structureCtxStableID = result.sessionOutputs[ 0 ].sessionProductStructures[ 0 ].stableId;
            return soaSvc.post( APP_SESSION_MANAGEMENT_SOA, 'createOrUpdateSavedSession', {
                sessionsToCreateOrUpdate: [ {
                    sessionToCreateOrUpdate: {
                        objectToUpdate: snapshotObjModelObject
                    },
                    productAndConfigsToCreate: [ {
                        structureRecipe: {
                            structureContextIdentifier: {
                                product: {
                                    uid: topLinesArray[ 0 ].uid
                                }
                            }
                        },
                        structureRecipeProps: {
                            fnd0CopyStableId: {
                                stringValues: [ structureCtxStableID ]
                            }
                        }
                    } ],
                    detachObjectOrProductsFromSession: [ structureCtxStableID ]
                } ]
            } );
        } );
};

/**
 * Rename snapshot on enter click on textbox
 * @param {Object} item vmo
 * @param {Object} snapshotDataProvider snapshot card data provider
 * @param {Object} data  view model data
 * @returns {Object} object containing snapshotEditInline and modifyProductSnapshotObject view model data
 */
export let inlineRenameProductSnapshot = function( item, snapshotDataProvider, data ) {
    let snapshotEditInline = { ...data.snapshotEditInline };
    let modifyProductSnapshotObject = { ...data.modifyProductSnapshotObject };
    snapshotEditInline.isEditable = false;
    snapshotEditInline.isEnabled = false;
    snapshotEditInline.autofocus = false;
    modifyProductSnapshotObject = '';
    //check if the object is selected
    let selectedProdSnapObj = _.isArray( snapshotDataProvider.selectedObj ) ? snapshotDataProvider.selectedObj[ 0 ] : snapshotDataProvider.selectedObj;
    if( !selectedProdSnapObj ) {
        snapshotDataProvider.selectionModel.setSelection( item );
        selectedProdSnapObj = item;
    }
    if( selectedProdSnapObj && snapshotEditInline.dbValue !== selectedProdSnapObj.cellHeader1 ) {
        _renameProductSnapshotSOA( selectedProdSnapObj, snapshotEditInline.dbValue, data );
    }
    return {
        snapshotEditInline: snapshotEditInline,
        modifyProductSnapshotObject: modifyProductSnapshotObject
    };
};

/**
 * Handle name click on snapshot card
 * @param {Object} item vmo
 * @param {Object} data view model data
 * @returns {Object} object containing snapshotEditInline and modifyProductSnapshotObject view model data
 */
export let handleTextEditClick = function( item, data ) {
    let snapshotEditInline = { ...data.snapshotEditInline };
    let modifyProductSnapshotObject = { ...data.modifyProductSnapshotObject };
    if( item.props.fnd0OwningIdentifier && item.props.fnd0OwningIdentifier.dbValue !== null || item.props.owning_user && item.props.owning_user.propertyDisplayName !== 'Owner' ) {
        return;
    }
    if( data.modifyProductSnapshotObject && data.modifyProductSnapshotObject.uid === item.uid ) {
        return; // to return for second unnecessary event
    }
    modifyProductSnapshotObject = item;
    snapshotEditInline.isEditable = true;
    snapshotEditInline.isEnabled = true;
    snapshotEditInline.autofocus = true;
    return {
        snapshotEditInline: snapshotEditInline,
        modifyProductSnapshotObject: modifyProductSnapshotObject
    };
};

/**
 * modify product snapshot
 *
 * @param  {Object} data view model
 */
export let modifyProductSnapshot = function( data ) {
    if( data.modifyProductSnapshotObject ) {
        inlineRenameProductSnapshot( data.modifyProductSnapshotObject, data );
    }
};

/**
 * Trigger update action of for snapshot list
 * @param {Object} snapshotPanelData snapshot atomic data
 */
let _updateSnapshotList = function( snapshotPanelData ) {
    if( !snapshotPanelData && snapshotPanelDataCtx ) {
        snapshotPanelData = snapshotPanelDataCtx;
    }
    if( snapshotPanelData ) {
        const updatedSnapshotPanelData = { ...snapshotPanelData.getValue() };
        updatedSnapshotPanelData.updateSnapshotList = !updatedSnapshotPanelData.updateSnapshotList;
        snapshotPanelData.update( updatedSnapshotPanelData );
    }
};

/**
 * Sets active view as snapshot panel
 * @param {Object} snapshotPanelData snapshot panel data
 * @returns {Object} updated snapshot panel data
 */
const setActiveListPanel = ( snapshotPanelData ) => {
    snapshotPanelData.activeView = 'ProductSnapshotListSub';
    return { ...snapshotPanelData };
};

/**
 * Rerender snapshot textbox
 * @param {Object} item snapshot vmo
 * @param {Object} snapshotEditInline snapshot textbox view model property
 * @returns {Object} which contains modified snapshot modified textbox property
 */
let renderTextBox = ( item, snapshotEditInline ) => {
    snapshotEditInline.dbValue = item.cellHeader1;
    snapshotEditInline.dispValue = item.cellHeader1;
    snapshotEditInline.uiValue = item.cellHeader1;
    return { ...snapshotEditInline };
};

/**
 * Rename and disable inline edit on selection of other snapshot
 * @param {Object} selectedSnapshot selected snapshot
 * @param {Object} item snapshot vmo
 * @param {Object} data view model data
 * @returns {Object} which contains modified snapshot modified textbox property and snapshot being edit
 */
let disableInlineEdit = ( selectedSnapshot, item, data ) => {
    if( data.modifyProductSnapshotObject && selectedSnapshot && data.modifyProductSnapshotObject.uid !== selectedSnapshot.uid ) {
        return _renameAndDisableInlineEdit( item, data );
    }
};

/**
 * handle snapshot thumnail click in card view
 * @param {Object} item snapshot vmo
 * @param {Object} data view model data
 * @returns {Object} which contains modified snapshot modified textbox property and snapshot being edit
 */
let handleThumbnailClick = ( item, data ) => {
    if( data.modifyProductSnapshotObject && data.modifyProductSnapshotObject.uid === item.uid ) {
        return _renameAndDisableInlineEdit( item, data );
    }
};

/**
 * Rename and disable inline edit of snapshot
 * @param {Object} item snapshot vmo
 * @param {Object} data view model data
 * @returns {Object} which contains modified snapshot modified textbox property and snapshot being edit
 */
let _renameAndDisableInlineEdit = ( item, data ) => {
    let snapshotEditInline = { ...data.snapshotEditInline };
    if( snapshotEditInline.dbValue !== data.modifyProductSnapshotObject.cellHeader1 ) {
        _renameProductSnapshotSOA( item, snapshotEditInline.dbValue, data );
    }
    snapshotEditInline.isEditable = false;
    snapshotEditInline.isEnabled = false;
    snapshotEditInline.autofocus = false;
    return {
        snapshotEditInline: snapshotEditInline,
        modifyProductSnapshotObject: ''
    };
};

/**
 * Rename snapshot object using SOA
 * @param {Object} item snapshot vmo
 * @param {String} newName new name for snapshot
 * @param {Object} data view model data
 */
let _renameProductSnapshotSOA = ( item, newName, data ) => {
    let inputData = [ {
        object: item,
        vecNameVal: [ {
            name: 'object_name',
            values: [
                newName
            ]
        } ]
    } ];

    /* update the name in Teamcenter*/
    soaSvc.post( 'Core-2010-09-DataManagement', 'setProperties', { info: inputData } ).then( function() {
        messagingService.showInfo( data.i18n.updatedProductSnapshotSuccessfully );
    } ).catch( ( error ) => {
        messagingService.showInfo( data.i18n.failedToUpdate );
        logger.error( 'ViewerSnapshotService: Product Snapshot rename failed: ' + error );
    } );
};

/**
 * Select product snapshot in product gallery
 * @param {Object} item snapshot vmo
 * @param {Object} dataProvider card view data provider
 */
let selectProductSnapshot = ( item, dataProvider ) => {
    dataProvider.selectionModel.setSelection( item );
};

/**
 * Sets viewer context for product snapshot in discussion
 * @param {Object} data view model data
 * @param {Object} snapshotDiscData snapshot discussion data
 */
let setViewerContext = ( data, snapshotDiscData ) => {
    let discCtx = { ...snapshotDiscData.getValue() };
    let viewerCtxData = _getViewerContextData( data.ctx );
    if( viewerCtxData ) {
        discCtx.isViewerRevealed = viewerCtxData.getValueOnViewerAtomicData( 'isViewerRevealed' );
        discCtx.viewerViewMode = viewerCtxData.getValueOnViewerAtomicData( 'viewerViewMode' );
        snapshotDiscData.update( discCtx );
    }
};

/**
 * Gets viewer context data when it is not available on command
 * @param {Object} ctx application context
 * @returns {Object} viewer context object
 */
let _getViewerContextData = ( ctx ) => {
    let occmgmtContextKey = ctx && ctx.aceActiveContext && ctx.aceActiveContext.key ? ctx.aceActiveContext.key : 'occmgmtContext';
    let viewerContextNamespace = viewerCtxSvc.getActiveViewerContextNamespaceKey( occmgmtContextKey );
    return viewerCtxSvc.getRegisteredViewerContext( viewerContextNamespace );
};

/**
 * buildTitle
 * @function buildTitle
 * @param {Object}searchObject - search state object
 * @return {Promise} Promise containing the localized text
 */
export let buildTitle = function( searchObject ) {
    if( searchObject ) {
        let totalFound;
        let label = '';
        //Get search Criteria, Total Found and Crumbs
        if( searchObject.totalFound >= 0 ) {
            totalFound = searchObject.totalFound;
        }
        if( searchObject.label ) {
            label = searchObject.label;
        }
        return searchFilterSvc.loadBreadcrumbTitle( label, null, totalFound ).then( ( localizedText ) => {
            return localizedText;
        } );
    }
    return Promise.resolve( {} );
};
export default exports = {
    productSnapshotPanelRevealed,
    createProductSnapshotAndNotify,
    createProductSnapshot,
    deleteProductSnapshot,
    deleteProductSnapshotAndNotify,
    startEditProductSnapshot,
    renameProductSnapshotAndNotify,
    clearPreviousProductSnapshotSelection,
    setProductSnapshotView,
    getFileURLFromTicket,
    getDefaultPageSize,
    updateProductSnapshotAndNotify,
    inlineRenameProductSnapshot,
    modifyProductSnapshot,
    updateProductSnapshotOnDiscussion,
    clearSnapshotDiscussionData,
    loadProductSnapshotDataForCard,
    createProductSnapshotOnDiscussion,
    setActiveListPanel,
    renderTextBox,
    handleTextEditClick,
    disableInlineEdit,
    handleThumbnailClick,
    selectProductSnapshot,
    setViewerContext,
    buildTitle
};
