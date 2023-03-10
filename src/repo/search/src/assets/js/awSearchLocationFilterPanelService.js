// Copyright (c) 2021 Siemens 
// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global*/

/**
 *
 * @module js/awSearchLocationFilterPanelService
 */
import eventBus from 'js/eventBus';
import 'lodash';
import appCtxService from 'js/appCtxService';
import commandPanelService from 'js/commandPanel.service';

export let openCloseFilterPanelAction = ( searchState ) => {
    let activationNavigationCommand = appCtxService.getCtx( 'activeNavigationCommand' );
    let activationToolsAndInfoCommand = appCtxService.getCtx( 'activeToolsAndInfoCommand' );
    let autoOpenPrefValue = appCtxService.getCtx( 'preferences.AW_Search_Auto_Open_Filter_Panel' );
    let autoOpenFilterPanel = !autoOpenPrefValue || autoOpenPrefValue && autoOpenPrefValue[ 0 ] === 'true';
    let eventData = {
        source: 'navigationPanel'
    };
    let isNarrowMode = window.matchMedia( '(max-width: 63.76em)' ).matches;
    if( searchState.totalLoaded !== undefined
        && searchState.totalLoaded === 0
        && searchState.additionalSearchInfoMap
        && activationNavigationCommand
        && activationNavigationCommand.commandId === 'Awp0SearchFilter'
        && searchState.additionalSearchInfoMap.searchExceededThreshold
        && ( searchState.additionalSearchInfoMap.searchExceededThreshold[ 0 ]
        && searchState.additionalSearchInfoMap.searchExceededThreshold[ 0 ].length > 0
        && searchState.additionalSearchInfoMap.searchExceededThreshold[ 0 ].toLowerCase() === 'false' || !searchState.additionalSearchInfoMap.searchExceededThreshold[ 0 ] ) ) {
        eventBus.publish( 'complete', eventData );
    } else if( searchState && searchState.categories && searchState.categories.length > 0 ) {
        if( activationNavigationCommand && activationNavigationCommand.commandId === 'Awp0Search' && isNarrowMode ) {
            // this is for the use case where executing search using the narrow mode should result in closing the search panel and showing the results
            eventBus.publish( 'complete', eventData );
        } else if( !isNarrowMode && autoOpenFilterPanel && ( !activationNavigationCommand && !activationToolsAndInfoCommand || activationNavigationCommand && activationNavigationCommand.commandId !== 'Awp0SearchFilter' ) ) {
            // this is for the use case where executing a search and getting back categories should result in filter panel opening up if it is already not open
            commandPanelService.activateCommandPanel( 'Awp0SearchFilter', 'aw_navigation' );
        }
    }
};

export let readAutoOpenFilterPanelPrefValue = () => {
    let autoOpenPrefValue = appCtxService.getCtx( 'preferences.AW_Search_Auto_Open_Filter_Panel' );
    return !autoOpenPrefValue || autoOpenPrefValue && autoOpenPrefValue[ 0 ] === 'true';
};

const awSearchLocationFilterPanelService = {
    openCloseFilterPanelAction,
    readAutoOpenFilterPanelPrefValue
};

export default awSearchLocationFilterPanelService;
