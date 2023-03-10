// @<COPYRIGHT>@
// ===========================================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ===========================================================================
// @<COPYRIGHT>@

/* global
 define
 */

/**
 * A service that has methods for intialization of the parent View.
 *
 * @module js/showPreferencesService
 */

import appCtxService from 'js/appCtxService';
import adminService from 'js/adminPreferencesService';
import adminPreferenceUserUtil from 'js/adminPreferenceUserUtil';
import AwPromiseService from 'js/awPromiseService';
import searchFilterService from 'js/aw.searchFilter.service';
import cdm from 'soa/kernel/clientDataModel';

'use strict';

export const initializeshowPreferences = ( searchState, searchStateUpdater ) => {

    adminService.setSupportedTCVersionForDeleteProductAreaContext() ;

    const activeFilters = searchFilterService.getFilters();
    const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( activeFilters );
    const activeFilterMap = selectedFiltersInfo.activeFilterMap;
    const  filterString = searchFilterService.buildFilterString( activeFilters );
    const newSearchState = { ...searchState };
    newSearchState.activeFilterMap = activeFilterMap;
    newSearchState.filterString = filterString;
    searchStateUpdater.searchState( newSearchState );

    var prm2;
    var deferredInput = AwPromiseService.instance.defer();
    deferredInput.resolve( adminPreferenceUserUtil.setUserPrivilege() );
    prm2 = deferredInput.promise;
    //adminPreferenceUserUtil.setUserPrivilege();
    return prm2.then( function() {
        var isAdmin = adminPreferenceUserUtil.isSystemAdmin();
        var isGroupAdmin = adminPreferenceUserUtil.isGroupAdmin();
        var ctxSys = appCtxService.getCtx( 'isAdmin' );
        let newCtxSys = { ...ctxSys };
        if( isAdmin || isGroupAdmin ) {
            newCtxSys = true;
        } else {
            newCtxSys = false;
        }
        appCtxService.updateCtx( 'isAdmin', newCtxSys );

        appCtxService.updatePartialCtx( 'tcadmconsole.preferences.isUserSystemAdmin', isAdmin );
        appCtxService.updatePartialCtx( 'tcadmconsole.preferences.isUserGroupAdmin', isGroupAdmin );

        if( !isAdmin && !isGroupAdmin ) {
            var session = cdm.getUserSession();
            if( session ) {
                // Access to any additional parents fields should require update of this method.
                var uid;
                var group = session.props.group;
                uid =  group.dbValues[ 0 ];
                appCtxService.updateCtx( 'groupUID', uid );

                var role = session.props.role;
                uid =  role.dbValues[ 0 ];
                appCtxService.updateCtx( 'roleUID', uid );

                var user = session.props.user;
                uid =  user.dbValues[ 0 ];
                appCtxService.updateCtx( 'userUID', uid );
            }
        }
    } );
};


const exports = {
    initializeshowPreferences
};

export default exports;

