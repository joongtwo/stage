// Copyright (c) 2022 Siemens

/**
 * @module js/tcAuthenticator
 */
import $ from 'jquery';
import browserUtils from 'js/browserUtils';
import logger from 'js/logger';
import configSvc from 'js/configurationService';

/**
 * {Boolean} TRUE if logging of certain milstone activities should occur.
 */
const _debug_logAuthActivity = browserUtils.getUrlAttributes().logAuthActivity !== undefined;

/**
 * Delegate to the user name/password type authentication.
 *
 * @return {Promise} Resolved with reference to {tcUserPwAuthenticator} service when loaded.
 */
function userAuth() {
    return import( 'js/tcUserPwAuthenticator' );
}

/**
 * Delegate to the Single Sign On (SSO) type authentication (if enabled)
 *
 * @return {Promise} Resolved with reference to {ssoAuthenticator} (or undefined if not using SSO).
 */
function ssoAuth() {
    return new Promise( resolve => {
        $.get( browserUtils.getBaseURL() + 'getSessionVars' ).done( function( data, status ) {
            if ( status === 'success' ) {
                exports.ConfigValues = data; // key value pairs?

                const devModePath = data.devModePath || 'dev';
                const regEx = new RegExp( `/${devModePath}(|/)$`, 'i' );
                configSvc.setDarsiEnabled( regEx.test( window.location.pathname ) );

                // Find the SSOenabled value - for explicit exposure.  It is a string.
                if ( data.tcSSOEnabled && data.tcSSOEnabled.toLowerCase() === 'true' ) {
                    import( 'js/ssoAuthenticator' ).then( resolve );
                    return; // don't resolve yet
                }
            }
            resolve();
        } ).fail( function() {
            resolve();
        } );
    } );
}

/**
 * Check if the app is being hosted and (if so) does it thing the user is authorized.
 *
 * @return {Promise} Resolved with a reference to the {hostAuthenticatorService} once it is determined
 * hosting is not being used OR the host returns TRUE from 'canIProcess' call (or NULL otherwise).
 */
function hostAuth() {
    // 1-A) is hosting flag on the URL  (-ah query string) see Hosting startup handler checks, and
    //     HostDetection.  The hosting case relies heavily on GWT, so that gets triggered in the bootstrap

    // only use the hosting authenticator if hosting flag is actually set.
    const urlAttrs = browserUtils.getWindowLocationAttributes();

    if ( urlAttrs.ah ? urlAttrs.ah.toLowerCase() === 'true' : false ) {
        let _hostAuthenticatorSvc;

        return import( 'js/hosting/hostAuthenticatorService' )
            .then( function( hostAuthenticatorSvc ) {
                _hostAuthenticatorSvc = hostAuthenticatorSvc.default;
                return _hostAuthenticatorSvc.canIProcess();
            } ).then( function( canIProcess ) {
                if ( _debug_logAuthActivity ) {
                    logger.info( `tcAuthenticator: hostAuth: hostAuthenticatorSvc.canIProcess: ${canIProcess}` );
                }
                if ( canIProcess ) {
                    return _hostAuthenticatorSvc;
                }
                return null;
            } );
    }

    if ( _debug_logAuthActivity ) {
        logger.info( 'tcAuthenticator: hostAuth: ' + 'Not in host mode' );
    }

    return Promise.resolve( null );
}

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// Public Functions
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

let exports = {};

/**
 * Determine which authenticator we have access to.
 *
 * @returns {Promise} Resolved with the authenticator we determined to to use ('hosting', 'sso' or 'user').
 */
export let getAuthenticator = function() {
    // Decision algorithm for which authenticator
    // 1) hosting gets first dibs.   (that decision is a bit complicated)
    // 2) if NOT hosting, then check for SSO
    // 3) if NOT hosting and not SSO Enabled, then fallback to userPW

    return hostAuth().then( function( authenticator ) {
        if ( !authenticator ) {
            return ssoAuth();
        }

        if ( _debug_logAuthActivity ) {
            logger.info( 'tcAuthenticator: getAuthenticator: ' + 'Using hostAuth' );
        }

        return authenticator;
    } ).then( function( authenticator ) {
        if ( !authenticator ) {
            if ( _debug_logAuthActivity ) {
                logger.info( 'tcAuthenticator: getAuthenticator: ' + 'Using userAuth' );
            }

            return userAuth();
        }

        if ( _debug_logAuthActivity ) {
            logger.info( 'tcAuthenticator: getAuthenticator: ' + 'Using ssoAuth' );
        }

        return authenticator;
    } );
};

export default exports = {
    getAuthenticator
};
