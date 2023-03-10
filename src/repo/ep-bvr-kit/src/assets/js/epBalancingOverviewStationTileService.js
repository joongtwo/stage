// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for rendering EpBalancingOverviewStationTile
 *
 * @module js/epBalancingOverviewStationTileService
 */

import epBalancingLabelsService from 'js/epBalancingLabelsService';

/**
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export function epBalancingOverviewStationTileRender( props ) {
    return (
        <div className='aw-epBalancing-stationTileProcessResourceTotalTimePanel' title={ props.vmo.props.bl_rev_object_name.dbValues[0] + ': ' + epBalancingLabelsService.stringToFloat( props.vmo.props.elb0cycleTime.dbValue ) }>
            {renderTimeBar( props.vmo.props, props.max )}
        </div>
    );
}

const renderTimeBar = ( vmoProps, max ) => {
    const taktTime = parseFloat( vmoProps.elb0taktTime.dbValues[ 0 ] );
    const cycleTime = parseFloat( vmoProps.elb0cycleTime.dbValues[ 0 ] );
    const availableTime = taktTime - cycleTime;
    const usedTime = cycleTime > taktTime ? taktTime : cycleTime;
    const exceedingTime = cycleTime > taktTime ? cycleTime - taktTime : 0;
    const cycleTimeString = cycleTime.toFixed( 2 );

    const maxTotalTime = parseFloat( max );
    const timeToSubstract = cycleTime > taktTime ? cycleTime : taktTime;
    const placeholderSize = maxTotalTime - timeToSubstract;

    return (
        <div className='aw-epBalancing-stationTileTotalTimeBarContainer'>
            { cycleTime === 0 && <div className='aw-epBalancing-stationTileStationBarZero'></div>}
            { taktTime > 0 && usedTime > 0 && <div className='aw-epBalancing-stationTileTotalTimeBarUsedTime' style={{ flexGrow: usedTime }}></div>}
            { availableTime > 0 && <div className='aw-epBalancing-stationTileTotalTimeBarPlaceholder' style={{ flexGrow: availableTime }}></div>}
            <div className='aw-epBalancing-stationTileTotalTimeBarCycleTime'></div>
            { exceedingTime > 0 && <div className='aw-epBalancing-stationTileTotalTimeBarExceedingTime' style={{ flexGrow: exceedingTime }}></div>}
            { exceedingTime > 0 && <div className='aw-epBalancing-stationTileTotalTimeBarExceedingTimeValue'>{epBalancingLabelsService.stringToFloat( cycleTime )}</div>}
            { exceedingTime === 0 && <div className='aw-epBalancing-stationTileTotalTimeBarExceedingTimeValue'></div>}
            { cycleTime < maxTotalTime && taktTime < maxTotalTime && <div className='aw-epBalancing-stationTileTotalTimeBarPlaceholder' style={{ flexGrow: placeholderSize }}></div>}
        </div>
    );
};

