// @<COPYRIGHT>@
// ===========================================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ===========================================================================
// @<COPYRIGHT>@

/* global
 define
 */

/**
 * A service that manages the delete of preferences.<br>
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/deletePreferencesService
 */

 import prefService from 'js/adminPreferencesService';
 import adminPreferenceUserUtil from 'js/adminPreferenceUserUtil';
 import appCtxSvc from 'js/appCtxService';
 import soaService from 'soa/kernel/soaService';
 import AwPromiseService from 'js/awPromiseService';
 import msgService from 'js/messagingService';
 import localeService from 'js/localeService';
 import editHandlerService from 'js/editHandlerService';
 import eventBus from 'js/eventBus';
 import _ from 'lodash';
 
 var exports = {};
 
 var _localTextBundle = null;
 
 /**
  * Set the delete preference context for display of commands.
  * @param {Object} selectedPreference the selected preference in the table.
  */
 export let setDeleteCtx = function( selectedPreference ) {
     var canDeleteInstance = false;
     var canDeleteDefinition = false;
     if( !_.isUndefined( selectedPreference ) && selectedPreference !== null && selectedPreference !== '' ) {
         var systemAdmin = adminPreferenceUserUtil.isSystemAdmin();
         var groupAdmin = adminPreferenceUserUtil.isGroupAdmin();
         if( systemAdmin ) {
             canDeleteDefinition = true;
             if( selectedPreference.props.prf1Location.displayValues[ 0 ] === _localTextBundle.None ) {
                 canDeleteInstance = false;
             } else {
                 canDeleteInstance = true;
             }
         } else if( groupAdmin && ( selectedPreference.props.prf1Location.dbValue === 'Group' || selectedPreference.props.prf1Location.dbValue === 'Role' ) ) {
             canDeleteInstance = true;
         } else if( selectedPreference.props.prf1Location.dbValue.startsWith( 'User' ) ) {
             canDeleteInstance = true;
         } else if( selectedPreference.props.prf1Location.dbValue === 'Overlay' ) {
             canDeleteInstance = false;
         } else {
             canDeleteInstance = false;
         }
         if( canDeleteInstance ) {
            if( selectedPreference.props.prf1Location.dbValue === 'COTS' ) {
                canDeleteInstance = false;
                canDeleteDefinition = false;
            }
         }

         /*var preferenceMap = prefService.getPrefFilters();
         if( canDeleteInstance ) {
             if( selectedPreference.props.prf1Location.dbValue === 'COTS' ) {
                 canDeleteInstance = false;
             } else if( selectedPreference.props.prf1Location.displayValues[ 0 ] === _localTextBundle.Site ) {
                 var preferenceInstances = preferenceMap.get( selectedPreference.props.fnd0ProductArea.dbValue ).get( selectedPreference.props.fnd0PreferenceName.dbValue );
                 // No need to find the exact instance since isOOTBPreference is same on all instances.
                 if( preferenceInstances[ 0 ].definition.isEnvEnabled === true ) {
                     preferenceInstances.forEach( function( preferenceInstance ) {
                         if( preferenceInstance.locationInfo.location.prefLoc === selectedPreference.props.prf1Location.dbValue ) {
                             if( _.isUndefined( preferenceInstance.locationInfo.values ) || preferenceInstance.locationInfo.values.length === 0 ||
                                 preferenceInstance.definition.isArray && preferenceInstance.locationInfo.values.length === 0 ) {
                                 canDeleteInstance = false;
                             }
                         }
                     } );
                 }
             }
         }
         if( canDeleteDefinition ) {
             var preferenceInstances1 = preferenceMap.get( selectedPreference.props.fnd0ProductArea.dbValue ).get( selectedPreference.props.fnd0PreferenceName.dbValue );
             // No need to find the exact instance since isOOTBPreference is same on all instances.
             if( preferenceInstances1[ 0 ].definition.isOOTBPreference === true ) {
                 canDeleteDefinition = false;
             }
         }*/
     }
     appCtxSvc.updatePartialCtx( 'tcadmconsole.preferences.canDeleteInstance', canDeleteInstance );
     appCtxSvc.updatePartialCtx( 'tcadmconsole.preferences.canDeleteDefinition', canDeleteDefinition );
 };
 
 /**
  * Show delete warning for preference definition.
  * @param {Object} data data object
  * @param {Object} selectedPreference the selected preference in the table.
  * @param {Object} prefCtx context for the preferences page
  *
  * @return {Promise} show delete warning.
  */
 export let confirmDeletePreferenceDefinition = function( data, selectedPreference, prefCtx ) {
     var deferred = AwPromiseService.instance.defer();
 
     var hasUnsavedEdits = adminPreferenceUserUtil.checkUnsavedEdits();
     if( hasUnsavedEdits ) {
         adminPreferenceUserUtil.handleUnsavedEdits( prefCtx );
     } else {
         var localTextBundle = localeService.getLoadedText( 'preferenceMessages' );
         var msg = localTextBundle.deleteDefinitionWarning;
         msg = msg.replace( '{0}', selectedPreference.props.prf1Name.dbValue );
         showDeleteWarning( data, deferred, msg );
     }
     return deferred.promise;
 };
 
 /**
  * Show delete warning for preference instance.
  * @param {Object} data data object
  * @param {Object} selectedPreference the selected preference in the table.
  * @param {Object} prefCtx context for the preferences page
  *
  * @return {Promise} show delete warning.
  */
 export let confirmDeletePreferenceInstance = function( data, selectedPreference, prefCtx ) {
     var deferred = AwPromiseService.instance.defer();
 
     var hasUnsavedEdits = adminPreferenceUserUtil.checkUnsavedEdits();
     if( hasUnsavedEdits ) {
         adminPreferenceUserUtil.handleUnsavedEdits( prefCtx );
     } else {
         var localTextBundle = localeService.getLoadedText( 'preferenceMessages' );
         var msg = localTextBundle.deleteInstanceWarning;
         msg = msg.replace( '{0}', selectedPreference.props.prf1Location.displayValues[ 0 ] );
         msg = msg.replace( '{1}', selectedPreference.props.prf1Name.dbValue );
         showDeleteWarning( data, deferred, msg );
     }
     return deferred.promise;
 };
 
 /**
  * Show delete warning message
  *
  * @param {Object} data - the data
  * @param {Object} deferred - the deferred
  * @param {Object} msg - Warning message
  */
 function showDeleteWarning( data, deferred, msg ) {
     var buttons = [ {
         addClass: 'btn btn-notify',
         text: data.i18n.cancel,
         onClick: function( $notify ) {
             $notify.close();
         }
     }, {
         addClass: 'btn btn-notify',
         text: data.i18n.delete,
         onClick: function( $notify ) {
             $notify.close();
             deferred.resolve();
         }
     } ];
     msgService.showWarning( msg, buttons );
 }
 
 /**
  * Delete a preference definition and refresh the table.
  * @param {Object} selectedPreference the selected preference in the table.
  *
  * @return {Promise} delete definition.
  */
 export let deletePreferenceDefinition = function( selectedPreference ) {
     var deletePreferencesDefinitionIn = {
         preferenceNames: [
             selectedPreference.props.prf1Name.dbValue
         ],
         deleteAllCustomDefinitions: false
     };
     return soaService
         .postUnchecked( 'Administration-2012-09-PreferenceManagement', 'deletePreferenceDefinitions', deletePreferencesDefinitionIn )
         .then( function( response ) {
             var err = adminPreferenceUserUtil.handleSOAResponseError( response );
             if( !_.isUndefined( err ) ) {
                 return adminPreferenceUserUtil.getRejectionPromise( err );
             }
             //prefService.resetService();
             appCtxSvc.ctx.selected = null;
             eventBus.publish( 'primaryWorkarea.reset' );
         } );
 };
 
 /**
  * Delete a preference instance and refresh the table.
  * @param {Object} selectedPreference the selected preference in the table.
  *
  * @return {Promise} delete instance.
  */
 export let deletePreferenceInstance = function( selectedPreference ) {
     var selectedProductArea = selectedPreference.props.prf1ProductArea.dbValue;
     var selectedPrefName = selectedPreference.props.prf1Name.dbValue;
     var selectedLocation = selectedPreference.props.prf1Location.uiValue;
     var soaLocation =  exports.getLocationInput( selectedLocation );

     //var prefInstanceToDelete = prefService.getSelectedPreferenceInstance( selectedProductArea, selectedPrefName, selectedLocation );
     var deletePreferencesAtLocationIn = {
         deletePreferencesAtLocationIn: [ {
             location: exports.getLocationInput( selectedLocation ),
             preferenceNames: [ selectedPreference.props.prf1Name.dbValue ]
         } ]
     };
     return soaService
         .postUnchecked( 'Administration-2012-09-PreferenceManagement', 'deletePreferencesAtLocations', deletePreferencesAtLocationIn )
         .then( function( response ) {
             var err = adminPreferenceUserUtil.handleSOAResponseError( response );
             if( !_.isUndefined( err ) ) {
                 return adminPreferenceUserUtil.getRejectionPromise( err );
             }
             //prefService.resetService();
             appCtxSvc.ctx.selected = null;
             eventBus.publish( 'primaryWorkarea.reset' );
             eventBus.publish( 'Preferences.updateUserOverrideCriteriaCtx' );
         } );
 };
 
 export let getLocationInput = function( selectedLocation ) {
     var groupUID = appCtxSvc.getCtx( 'groupUID' );
     var userUID = appCtxSvc.getCtx( 'userUID' );
     var roleUID = appCtxSvc.getCtx( 'roleUID' );

     if( selectedLocation.startsWith( 'Site' ) ) {
        var siteLoc = 'Site';
       
        return {location: siteLoc};
      }
 
     if( selectedLocation.startsWith( 'Group' ) ) {
         var OrgObject = {
                 type : 'Group',
                 uid : groupUID
             };
     } else if( selectedLocation.startsWith( 'Role' ) ) {
         var OrgObject = {        
            type : 'Role',
            uid : roleUID
     };
     } else if( selectedLocation.startsWith( 'User' ) ) {
         var OrgObject = {
            type : 'User',
            uid : userUID
     };
    }
     return { object: OrgObject };
    };

 
 _localTextBundle = localeService.getLoadedText( 'preferenceMessages' );
 
 export default exports = {
     setDeleteCtx,
     confirmDeletePreferenceDefinition,
     confirmDeletePreferenceInstance,
     deletePreferenceDefinition,
     deletePreferenceInstance,
     getLocationInput
 };
