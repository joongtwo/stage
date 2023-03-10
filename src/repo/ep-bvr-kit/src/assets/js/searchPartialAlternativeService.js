// Copyright (c) 2022 Siemens

/**
 * @module js/searchPartialAlternativeService
 */
import eventBus from 'js/eventBus';
import _appCtxService from 'js/appCtxService';
import _epLoadInputHelper from 'js/epLoadInputHelper';
import _epLoadService from 'js/epLoadService';
import { constants as _epLoadConstants } from 'js/epLoadConstants';
import _messagingService from 'js/messagingService';
import _localeService from 'js/localeService';
import epNavigationService from 'js/epNavigationService';

const NAVIGATE_TO_NEWTAB = 'newTab';

/**
 * Get alternatives
 */
function getAllAltList() {
    return _appCtxService.getCtx( 'allAltCCsList' );
}

/**
 * Open selected alternative in new tab
 * @param  ccUid
 */
function openAltInNewTab( ccUid ) {
    const currentObject = _appCtxService.getCtx( 'ep.scopeObject' );
    const loadTypeInputs = _epLoadInputHelper.getLoadTypeInputs( _epLoadConstants.OBJ_IN_RELATED_PACKAGE,
        currentObject.uid, '', ccUid );
    _epLoadService.loadObject( loadTypeInputs, false ).then( function( output ) {
        const lineMap = output.relatedObjectsMap;
        let lineUid;
        for( let key in lineMap ) {
            lineUid = lineMap[ key ].additionalPropertiesMap2.objectInRelatedPackage[ 0 ];
        }
        eventBus.publish( 'aw.closePopup' );
        epNavigationService.navigteToSameStateWithDifferentConfiguration( lineUid, NAVIGATE_TO_NEWTAB );
    } );
}

/**
 * Set or Search for the specific alternatives by name
 * @param {string} filterText - string to filter
 * @param {ObjectArray} altCCs - the list of Alternatives
 * @param {Integer} startIndex - start index of alternatives
 */
function filterAltCCList( filterText, altCCs, startIndex ) {
    if( filterText !== '' ) {
        const resource = _localeService.getLoadedText( 'AlternativeMessages' );
        let pagesize = altCCs.length;
        let endIndex = startIndex + pagesize;
        let filteredAltCCs = [];
        let altCCNamesMap = {};
        let altCCNames = [];
        altCCs.forEach( function( cc ) {
            const ccName = cc.props.object_string.dbValues[ 0 ];
            altCCNamesMap[ ccName ] = cc;
            altCCNames.push( ccName );
        } );

        const filteredAltNames = altCCNames.filter( function( alt ) {
            return alt.toLowerCase().indexOf( filterText.toLowerCase() ) >= 0;
        } );

        filteredAltNames.forEach( function( ccName ) {
            filteredAltCCs.push( altCCNamesMap[ ccName ] );
        } );

        if( filteredAltCCs.length === 0 ) {
            _messagingService.showInfo( resource.noSearchResult );
        }

        return {
            alternatives: filteredAltCCs.slice( startIndex, endIndex ),
            totalFound: filteredAltCCs.length
        };
    }
    return {
        alternatives: altCCs,
        totalFound: altCCs.length
    };
}

export default {
    getAllAltList,
    openAltInNewTab,
    filterAltCCList
};
