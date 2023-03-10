// Copyright (c) 2021 Siemens

/**
 * This Proximity service provider
 *
 * @module js/viewerProximityManagerProvider
 */
import viewerSelMgrProvider from 'js/viewerSelectionManagerProvider';
import _ from 'lodash';
import assert from 'assert';
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';

import '@swf/ClientViewer';

/**
 * Provides an instance of viewer Proximity manager
 *
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 *
 * @return {ViewerProximityManager} Returns viewer Proximity manager
 */
export let getProximityManager = function( viewerView, viewerContextData ) {
    return new ViewerProximityManager( viewerView, viewerContextData );
};

const GEOANALYSIS_VIEWER_PROXIMITY = 'geoAnalysisProximitySearchCtxData'; //$NON-NLS-1$
const GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST = 'targetList'; //$NON-NLS-1$
const GEOANALYSIS_VIEWER_PROXIMITY_NEW_TARGET_FOR_LIST = 'newTargetForList';//$NON-NLS-1$
const GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST_PKDCSIDS = 'targetListPkdCsids';//$NON-NLS-1$
const GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST_USED_PCI_UID = 'usedProductContextUid';//$NON-NLS-1$
const GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST_UPDATE_TARGET_LIST = 'updateTargetList';//$NON-NLS-1$
const GEOANALYSIS_VIEWER_PROXIMITY_TARGET_CSID_LIST = 'targetList'; //$NON-NLS-1$

const UNITS = {
    mm: 1,
    cm: 2,
    m: 3,
    in: 4,
    ft: 5,
    yd: 6,
    um: 7,
    dm: 8,
    km: 9,
    mils: 10
};

/**
 * Class to hold the viewer Proximity data
 *
 * @constructor ViewerProximityManager
 *
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 */
class ViewerProximityManager {
    /**
      * ViewerProximityManager class constructor
      *
      * @constructor ViewerProximityManager
      *
      * @param {Object} viewerView Viewer view
      * @param {Object} viewerContextData Viewer Context data
      */
    constructor( viewerView, viewerContextData ) {
        assert( viewerView, 'Viewer view can not be null' );
        assert( viewerContextData, 'Viewer context data can not be null' );
        this.viewerView = viewerView;
        this.viewerContextData = viewerContextData;
    }

    /**
     * compare target selection with current selection
     */
    comparetargetsWithSelections( geoAnalysisProximitySearch ) {
        let targetList = [];
        let selectionList = [];

        let geoAnalysisProximityAtomicData = { ...geoAnalysisProximitySearch.getValue() };
        if( geoAnalysisProximityAtomicData !== undefined && geoAnalysisProximityAtomicData.targetList !== undefined ) {
            for( let i = 0; i < geoAnalysisProximityAtomicData.targetList.length; i++ ) {
                targetList.push( geoAnalysisProximityAtomicData.targetList[ i ].uid );
            }
        }

        var selections = this.getCurrentViewerSelections();
        if ( !Array.isArray( selections ) ) {
            geoAnalysisProximityAtomicData[GEOANALYSIS_VIEWER_PROXIMITY_NEW_TARGET_FOR_LIST] = false;
            geoAnalysisProximitySearch.update( { ...geoAnalysisProximityAtomicData } );
            return;
        }
        for( let i = 0; selections !== undefined && i < selections.length; i++ ) {
            selectionList.push( selections[ i ].uid );
        }

        var diff = _.difference( selectionList, targetList );

        if( diff.length === 0 ) {
            geoAnalysisProximityAtomicData[GEOANALYSIS_VIEWER_PROXIMITY_NEW_TARGET_FOR_LIST] = false;
        } else {
            geoAnalysisProximityAtomicData[GEOANALYSIS_VIEWER_PROXIMITY_NEW_TARGET_FOR_LIST] = true;
        }
        geoAnalysisProximitySearch.update( { ...geoAnalysisProximityAtomicData } );
    }

    /**
     * get current selected model object
     *
     * @returns {object} current selection model object
     */
    getCurrentViewerSelections() {
        let panelContext = appCtxSvc.getCtx( 'panelContext' );
        if( _.isUndefined( panelContext ) ) {
            return;
        }
        let viewerSelectionCSIDS = this.viewerContextData.getValueOnViewerAtomicData( viewerSelMgrProvider.SELECTED_CSID_KEY );
        if( _.isUndefined( viewerSelectionCSIDS ) || viewerSelectionCSIDS.length === 0 ) {
            return null;
        }
        return this.viewerContextData.getValueOnViewerAtomicData( viewerSelMgrProvider.SELECTED_MODEL_OBJECT_KEY );
    }

    /**
     * get current selected CSIDs
     *
     * @returns {string} current selection CSIDs
     */
    getCurrentViewerSelectionCsIds() {
        let viewerSelectionCSIDS = this.viewerContextData.getValueOnViewerAtomicData( viewerSelMgrProvider.SELECTED_CSID_KEY );
        if( _.isUndefined( viewerSelectionCSIDS ) || viewerSelectionCSIDS.length === 0 ) {
            return [ '' ]; //root
        }
        return viewerSelectionCSIDS;
    }

    /**
     * Get target Occurrence list's clone stable UID chain for Proximity
     *
     * @param {Object} geoAnalysisProximitySearch proximity atomic data
     * @return {String[]} clone stable UID chain list
     */
    static getProximityTargetOccList( geoAnalysisProximitySearch ) {
        let proximityCtx = { ...geoAnalysisProximitySearch.getValue() };
        let targetListPkdCsids = proximityCtx.targetListPkdCsids; //$NON-NLS-1$
        let occClsIdList = proximityCtx.targetCsidList; //$NON-NLS-1$

        // add packed ids as well
        if( targetListPkdCsids !== undefined && !_.isEmpty( targetListPkdCsids ) ) {
            for( var i = 0; i < targetListPkdCsids.length; i++ ) {
                occClsIdList.push( targetListPkdCsids[ i ] );
            }
        }

        return occClsIdList;
    }

    /**
     * Executes proximity search on server.
     * @param  {[Object]} occObjList occ objects
     * @returns {Promise} A promise resolved
     */
    executeSearchOnServer( occObjList ) {
        let promiseToResolveOnComplete = AwPromiseService.instance.defer();
        return this.viewerView.proximityMgr.executeWithTargetOccurrences( occObjList ).then( function() {
            return this.viewerView.proximityMgr.getClearanceCalcPercentDone()
                .then( function( percentageDone ) {
                    if( percentageDone < 100 ) {
                        this.executeSearchOnServer( occObjList );
                    } else {
                        return promiseToResolveOnComplete.resolve();
                    }
                }.bind( this ) );
        }.bind( this ) );
    }

    /**
     * execute proximity search
     *
     * @param {Object} geoAnalysisProximitySearch proximity atomic data
     * @returns {function} function
     */
    executeProximitySearch( geoAnalysisProximitySearch ) {
        var occList = ViewerProximityManager.getProximityTargetOccList( geoAnalysisProximitySearch );
        var occObjList = [];

        for( var idx = 0; idx < occList.length; idx++ ) {
            occObjList.push( this.viewerContextData.getViewerCtxSvc().createViewerOccurance( occList[ idx ], this.viewerContextData ) );
        }
        return this.executeSearchOnServer( occObjList );
    }

    /**
     * Execute proximity search
     *
     * @param {Number} distance the distance
     * @param {Object} geoAnalysisProximitySearch proximity atomic data
     *
     * @returns {Promise} A promise resolved/rejcted
     */
    executeProximitySearchInDistance( distance, geoAnalysisProximitySearch ) {
        return this.viewerView.proximityMgr.setClearanceValue( distance ).then( function() {
            return this.executeProximitySearch( geoAnalysisProximitySearch );
        }.bind( this ) );
    }
}

export default {
    GEOANALYSIS_VIEWER_PROXIMITY,
    GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST,
    GEOANALYSIS_VIEWER_PROXIMITY_NEW_TARGET_FOR_LIST,
    UNITS,
    GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST_PKDCSIDS,
    GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST_USED_PCI_UID,
    GEOANALYSIS_VIEWER_PROXIMITY_TARGETLIST_UPDATE_TARGET_LIST,
    GEOANALYSIS_VIEWER_PROXIMITY_TARGET_CSID_LIST,
    getProximityManager
};
