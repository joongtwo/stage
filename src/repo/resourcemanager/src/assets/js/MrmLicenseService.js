// Copyright (c) 2022 Siemens

/**
 * @module js/MrmLicenseService
 */
import soaSvc from 'soa/kernel/soaService';
import appCtxService from 'js/appCtxService';
import messagingService from 'js/messagingService';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import mrmResourceGraphConstants from 'js/MrmResourceGraphConstants';
import mrmResourceGraphUtils from 'js/MrmResourceGraphUtils';
import mrlDashboardUtils from 'js/mrlDashboardUtils';

var exports = {};

/**
 * Checks MRL license
 */
export let chekMRMLicense = function() {
    var contextKey;
    var locationCtx = appCtxService.getCtx( 'locationContext' );

    if( locationCtx[ 'ActiveWorkspace:SubLocation' ] === mrmResourceGraphConstants.MRMResourceGraphConstants.OccurrenceManagementSubLocationId ) {
        contextKey = mrmResourceGraphConstants.MRMResourceGraphConstants.OccurenceManagementContextKey;
    } else if( locationCtx[ 'ActiveWorkspace:Location' ] === mrmResourceGraphConstants.MRMResourceGraphConstants.ManageResourcesLocationId ) {
        contextKey = mrmResourceGraphConstants.MRMResourceGraphConstants.SearchContextKey;
    }

    const currentContext = appCtxService.getCtx( contextKey );
    let newContext = { ...currentContext };
    var isMRMLicenseAvailable = newContext.isMRMLicenseAvailable;

    if ( isMRMLicenseAvailable !== undefined ) {
        if ( isMRMLicenseAvailable === false ) {
            var topComponentName;
            var mrmLicenseNotAvailableErrorText;
            if ( contextKey === mrmResourceGraphConstants.MRMResourceGraphConstants.OccurenceManagementContextKey ) {
                topComponentName = currentContext.topElement.props.object_string.uiValues[0];
                mrmLicenseNotAvailableErrorText = mrmResourceGraphUtils.getMRMGraphLocalizedMessage( 'MRM0LicenseNotAvailableMessage', topComponentName );
            } else {
                mrmLicenseNotAvailableErrorText = mrlDashboardUtils.getMRLDashboardLocalizedMessage( 'mrlLicenseNotAvailableMessage' );
            }
            var msgObj = {
                msg: mrmLicenseNotAvailableErrorText,
                level: 3
            };
            messagingService.showError( msgObj.msg );
        }

        return;
    }

    var inputData = {
        licAdminInput: [
            {
                featureKey: mrmResourceGraphConstants.MRMResourceGraphConstants.MRMLicenseKey,
                licensingAction: 'get'
            }
        ]
    };

    var deferred = AwPromiseService.instance.defer();

    return soaSvc.postUnchecked( 'Core-2019-06-Session', 'licenseAdmin', inputData ).then( function( response ) {
        if ( response.partialErrors ) {
            newContext.isMRMLicenseAvailable = false;
            var isMRMLicenseNotAvailableError = false;
            _.forEach( response.partialErrors, function( partialError ) {
                _.forEach( partialError.errorValues, function( error ) {
                    if ( error.code === 26025 ) {
                        isMRMLicenseNotAvailableError = true;
                    }
                } );
            } );

            if ( isMRMLicenseNotAvailableError ) {
                var topComponentName;
                var mrmLicenseNotAvailableErrorText;
                if ( contextKey === mrmResourceGraphConstants.MRMResourceGraphConstants.OccurenceManagementContextKey ) {
                    topComponentName = currentContext.topElement.props.object_string.uiValues[0];
                    mrmLicenseNotAvailableErrorText = mrmResourceGraphUtils.getMRMGraphLocalizedMessage( 'MRM0LicenseNotAvailableMessage', topComponentName );
                } else {
                    mrmLicenseNotAvailableErrorText = mrlDashboardUtils.getMRLDashboardLocalizedMessage( 'mrlLicenseNotAvailableMessage' );
                }
                var msgObj = {
                    msg: mrmLicenseNotAvailableErrorText,
                    level: 3
                };
                messagingService.showError( msgObj.msg );
            } else {
                processPartialErrors( response );
            }
        } else {
            newContext.isMRMLicenseAvailable = true;
        }

        appCtxService.updateCtx( contextKey, newContext );
        deferred.resolve( response );
    },
    function( error ) {
        deferred.reject( error );
    } );

    return deferred.promise;
};

var processPartialErrors = function( response ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if ( response.partialErrors ) {
        _.forEach( response.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    if ( msgObj.level <= 1 ) {
        messagingService.showInfo( msgObj.msg );
    } else {
        messagingService.showError( msgObj.msg );
    }
};

var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        if ( msgObj.msg.length > 0 ) {
            msgObj.msg += '<br>';
        }
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

export default exports = {
    chekMRMLicense
};
