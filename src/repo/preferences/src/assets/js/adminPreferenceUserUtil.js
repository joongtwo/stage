// Copyright (c) 2022 Siemens

/**
 * A service that has util methods which can be use in other js files of preferences module.
 *
 * @module js/adminPreferenceUserUtil
 */
import soaService from 'soa/kernel/soaService';
import cdmService from 'soa/kernel/clientDataModel';
import dmService from 'soa/dataManagementService';
import AwPromiseService from 'js/awPromiseService';
import editHandlerService from 'js/editHandlerService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';

var exports = {};

/**
 * Flag to show whether logged-in user has System Administrator privilege or not
 */
var _isSysAdm = false;

/**
 * Flag to show whether logged-in user has Group Administrator privilege or not
 */
var _isGroupAdm = false;

/**
 * This flag is initialized when the Preference page is reloaded. This flag
 * also decides whether logged-in user privilege has already been fetched or not
 */
var _isInitialized = false;

/**
 * Async method to set logged-in user privilege
 *
 * @return {Promise} _isInitialized
 */
export let setUserPrivilege = function() {
    if( !_isInitialized ) {
        return exports.setSystemAdmin().then( function() {
            return exports.setGroupAdmin().then( function() {
                _isInitialized = true;
                return _isInitialized;
            } );
        } );
    }
    var deferred = AwPromiseService.instance.defer();
    deferred.resolve();
    return deferred.promise;
};

/**
 * Async method to fetch and set System Administrator privilege for logged-in user.
 *
 * @return {Promise} _isInitialized
 */
export let setSystemAdmin = function() {
    var propName = 'privilege';

    // Get group id
    var group = cdmService.getUserSession().props.group.dbValues[ 0 ];

    // Check whether group MO has 'privilege' property loaded or not
    var modelObject = cdmService.getObject( group );
    if( modelObject ) {
        if( modelObject.modelType.propertyDescriptorsMap.hasOwnProperty( propName ) && modelObject.props && modelObject.props.hasOwnProperty( propName ) ) {
            _isSysAdm = parseInt( modelObject.props[ propName ].dbValues[ 0 ] ) !== 0;
            var deferred = AwPromiseService.instance.defer();
            deferred.resolve( _isSysAdm );
            return deferred.promise;
        }
    }

    var propPromise = dmService.getProperties( [ group ], [ propName ] );
    return propPromise.then( function( response ) {
        if( response && response.modelObjects ) {
            // true means that group has system administration privilege, and so all the members
            // of this group also have system administration privilege.
            _isSysAdm = parseInt( response.modelObjects[ group ].props[ propName ].dbValues[ 0 ] ) !== 0;
            return _isSysAdm;
        }
    } );
};

/**
 * Async method to fetch and set Group Administrator privilege for logged-in user.
 *
 * @return {Promise} _isGroupAdm
 */
export let setGroupAdmin = function() {
    var propName = 'ga';
    var groupMember = cdmService.getUserSession().props.fnd0groupmember.dbValues[ 0 ];

    // Check whether group MO has 'privilege' property loaded or not
    var modelObject = cdmService.getObject( groupMember );
    if( modelObject ) {
        if( modelObject.modelType.propertyDescriptorsMap.hasOwnProperty( propName ) && modelObject.props && modelObject.props.hasOwnProperty( propName ) ) {
            _isGroupAdm = parseInt( modelObject.props[ propName ].dbValues[ 0 ] ) !== 0;
            var deferred = AwPromiseService.instance.defer();
            deferred.resolve( _isGroupAdm );
            return deferred.promise;
        }
    }

    var propPromise = dmService.getProperties( [ groupMember ], [ propName ] );
    return propPromise.then( function( response ) {
        if( response && response.modelObjects ) {
            // true means that group has system administration privilege, and so all the members
            // of this group also have system administration privilege.
            _isGroupAdm = parseInt( response.modelObjects[ groupMember ].props[ propName ].dbValues[ 0 ] ) !== 0;
            return _isGroupAdm;
        }
    } );

    // SessionService sessionSvc = SessionService.getService( getTCSession() );
    // GetGroupMembershipResponse response = sessionSvc.getGroupMembership();
    // TCComponentGroupMember[] groupMembers = response.groupMembers;
    // if( groupMembers != null && groupMembers.length > 0 )
    // {
    //     for( TCComponentGroupMember element : groupMembers )
    //     {
    //         if( element.getPriv() )
    //         {
    //             // Yahoo! I do have the GA privileges.
    //             isGroupAdmin = true;
    //             break;
    //         }
    //     }
    // }
};

/**
 * Getter for _isSysAdm
 *
 * @return {Boolean} _isSysAdm
 */
export let isSystemAdmin = function() {
    return _isSysAdm;
};

/**
 * Getter for _isInitialized
 *
 * @return {Boolean} _isInitialized
 */
export let isInitialized = function() {
    return _isInitialized;
};

/**
 * Sets isInitialized
 * @param {Boolean} isInitialized new value for inititialized
 */
export let setIsInitialized = function( isInitialized ) {
    _isInitialized = isInitialized;
};

/**
 * Getter for _isGroupAdm
 *
 * @return {Boolean} _isGroupAdm
 */
export let isGroupAdmin = function() {
    return _isGroupAdm;
};

/**
 * Resets the states for _isSysteAdm, _isGroupAdm, and _isInitialized
 */
export let resetStates = function() {
    _isSysAdm = false;
    _isGroupAdm = false;
    _isInitialized = false;
};

/**
 * Resets the states for _isInitialized
 */
export let resetIsInitialized = function() {
    _isInitialized = false;
};
/**
 * convert the string to boolean.
 * @param  {String}  strValue - "true" or "false"
 *
 * @return {Boolean} true\false
 */
export let convertToBoolean = function( strValue ) {
    return _.isBoolean( strValue ) ? strValue : strValue !== 'false';
};

/**
 * Common method to process response and return err object
 * @param  {Object}  response - response from SOA
 *
 * @return {Object} 'error' object
 */
export let handleSOAResponseError = function( response ) {
    var err;
    if( response && response.partialErrors ) {
        err = soaService.createError( response );
        err.message = '';
        _.forEach( response.partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( object ) {
                err.message += '<BR/>';
                err.message += object.message;
            } );
        } );
    }
    return err;
};

/**
 * Return rejection Promise object from err object
 * @param  {Object}  err - 'error' object
 *
 * @return {Promise} 'rejection' Promise
 */
export let getRejectionPromise = function( err ) {
    var deferred = AwPromiseService.instance.defer();
    deferred.reject( err );
    return deferred.promise;
};

/**
 * Return rejection Promise object from err object
 * @param  {Object}  prefCtx - preferences context object for preferences page
 *
 * @return {boolean} 'rejection' Promise
 */
export let checkAndHandleUnsavedEdits = function( prefCtx ) {
    var prefEditHandler = editHandlerService.getEditHandler( 'PREF_EDIT_CONTEXT' );
    if( prefEditHandler && prefEditHandler.editInProgress() && prefEditHandler.isDirty() ) {
        prefEditHandler.setResetPWA( true );
        editHandlerService.setActiveEditHandlerContext( 'PREF_EDIT_CONTEXT' );
        return editHandlerService.leaveConfirmation().then( function() {
            var ctxeditInProgress = appCtxSvc.getCtx( 'tcadmconsole.preferences' );
            let newctxEdit = { ...ctxeditInProgress };
            if( ctxeditInProgress.editInProgress ) {
                newctxEdit.editInProgress = false;
            }
            appCtxSvc.updateCtx( 'tcadmconsole.preferences', newctxEdit );
            return true;
        } );
    }
    return AwPromiseService.instance.when( false );
};

/**
 * Checks whether summary panel has unsaved edits.
 *
 * @return {boolean} - true if there are any unsaved edits eg dialog\page is dirty
 */
export let checkUnsavedEdits = function() {
    var prefEditHandler = editHandlerService.getEditHandler( 'PREF_EDIT_CONTEXT' );
    return prefEditHandler && prefEditHandler.editInProgress() && prefEditHandler.isDirty();
};

/**
 * Handles unsave edits by showing confirmation panel through edit handler.
 * @param  {Object}  prefCtx - preferences context object for preferences page
 *
 */
export let handleUnsavedEdits = function( prefCtx ) {
    var prefEditHandler = editHandlerService.getEditHandler( 'PREF_EDIT_CONTEXT' );
    if( prefEditHandler !== null && prefEditHandler.editInProgress() && prefEditHandler.isDirty() ) {
        prefEditHandler.setResetPWA( true );
        editHandlerService.setActiveEditHandlerContext( 'PREF_EDIT_CONTEXT' );
        editHandlerService.leaveConfirmation().then( function() {
            var ctxeditInProgress = appCtxSvc.getCtx( 'tcadmconsole.preferences' );
            let newctxEdit = { ...ctxeditInProgress };
            if( ctxeditInProgress.editInProgress ) {
                newctxEdit.editInProgress = false;
            }
            appCtxSvc.updateCtx( 'tcadmconsole.preferences', newctxEdit );
        } );
    }
};

export let getUserSession = function() {
    return cdmService.getUserSession();
};

export default exports = {
    setUserPrivilege,
    setSystemAdmin,
    setGroupAdmin,
    isSystemAdmin,
    isInitialized,
    setIsInitialized,
    isGroupAdmin,
    resetStates,
    resetIsInitialized,
    convertToBoolean,
    handleSOAResponseError,
    getRejectionPromise,
    checkAndHandleUnsavedEdits,
    checkUnsavedEdits,
    handleUnsavedEdits,
    getUserSession
};
