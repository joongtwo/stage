// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for rendering EpBalancingProcessResourceTile
 *
 * @module js/epBalancingProcessResourceTileService
 */

import AwIcon from 'viewmodel/AwIconViewModel';
import epBalancingLabelsService from 'js/epBalancingLabelsService';
import localeService from 'js/localeService';
import epTimeUnitsService from 'js/epTimeUnitsService';

const balancingMessages = localeService.getLoadedText( 'BalancingMessages' );
const timeUnits = epTimeUnitsService.getCurrentTimeUnitShort();

/**
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export function epBalancingProcessResourceTileRender( props ) {
    const isSelected = props.vmo && props.selection && props.vmo.uid === props.selection.uid;

    const classes = isSelected ? 'aw-epBalancing-stationTileProcessResourceTotalTimePanel aw-epBalancing-stationTileProcessResourceTotalTimePanelSelected ' :
        'aw-epBalancing-stationTileProcessResourceTotalTimePanel ';

    if( props.vmo.type === 'Mfg0BvrProcessResource' ) {
        return (
            <div vmouid={props.vmo.uid} className={classes} >
                {renderNameAndCapacityContainer( props.vmo.props )}
                {renderTimeBar( props.vmo.props, props.max )}
                {renderClockIcon()}

                {renderWorkTime( props.vmo.props )}

            </div>
        );
    }

    if( props.prs ) {
        // line has process resources - show unassinged bar
        // TODO need to get the real bar classes and data

        if( props.vmo.props.elb0unassignedOpsByPV.dbValues.length === 0 ) {
            // no unassigned operations
            return null;
        }

        const unassignedTime = props.vmo.props.elb0unassignedTimeByPV.displayValues[ 0 ];
        const placeholderSize = props.max - parseFloat( unassignedTime );
        const unassignedClasses = isSelected ? 'aw-epBalancing-stationTileUnassignedTimePanel aw-epBalancing-stationTileUnassignedTimePanelSelected ' : 'aw-epBalancing-stationTileUnassignedTimePanel';
        return (
            <div vmouid={props.vmo.uid} className={unassignedClasses}>
                <div className='aw-epBalancing-stationTileUnassignedTitle' title={ balancingMessages.unassigned }>{ balancingMessages.unassigned }</div>
                <div className='aw-epBalancing-stationTileUnassignedTotalTimeBarContainer'>
                    <div className='aw-epBalancing-stationTileTotalTimeBarUnassignedTime' style={{ flexGrow: unassignedTime }}></div>
                    <div className='aw-epBalancing-stationTileUnassignedBarPlaceholder'></div>
                    <div className='aw-epBalancing-stationTileTotalTimeBarPlaceholder' style={{ flexGrow: placeholderSize }}></div>
                </div>
                {renderClockIcon()}
                <div className='aw-epBalancing-stationTileTotalTimeField' title={ balancingMessages.totalTime + ' ' + epBalancingLabelsService.stringToFloat( unassignedTime ) + ' ' + timeUnits }>{epBalancingLabelsService.stringToFloat( unassignedTime )}</div>
            </div>
        );
    }

    // line dose not have process resources - show station bar
    return (
        <div className={classes}>
            {renderTimeBar( props.vmo.props, props.max )}
            {renderClockIcon()}
            {renderWorkTime( props.vmo.props )}
        </div>
    );
}

const renderClockIcon = () => {
    return (
        <div className='aw-epBalancing-stationTileClockIcon'>
            <AwIcon iconId='cmdTime'></AwIcon>
        </div>
    );
};

const renderTimeBar = ( vmoProps, max ) => {
    const taktTime = parseFloat( vmoProps.elb0taktTime.dbValues[ 0 ] );
    const workContent = parseFloat( vmoProps.elb0workContentByPV.dbValues[ 0 ] );
    const availableTime = taktTime - workContent;
    const usedTime = workContent > taktTime ? taktTime : workContent;
    const exceedingTime = workContent > taktTime ? workContent - taktTime : 0;
    const availableTimeClass = availableTime < 0 ? 'aw-epBalancing-stationTileTotalTimeBarExceedingTimeValue' : 'aw-epBalancing-stationTileTotalTimeBarAvailableTimeValue';

    const maxTotalTime = parseFloat( max );
    const timeToSubstract = workContent > taktTime ? workContent : taktTime;
    const placeholderSize = maxTotalTime - timeToSubstract;
    return (
        <div className='aw-epBalancing-stationTileTotalTimeBarContainer' title={ balancingMessages.stationTaktTime + ' ' + taktTime + ' ' + timeUnits + ', ' + balancingMessages.availableTime + ' ' + availableTime + ' ' + timeUnits }>
            { taktTime > 0 && usedTime > 0 && <div className='aw-epBalancing-stationTileTotalTimeBarUsedTime' style={{ flexGrow: usedTime }}></div>}
            { availableTime > 0 && <div className='aw-epBalancing-stationTileTotalTimeBarPlaceholder' style={{ flexGrow: availableTime }}></div>}
            <div className='aw-epBalancing-stationTileTotalTimeBarCycleTime'></div>
            { exceedingTime > 0 && <div className='aw-epBalancing-stationTileTotalTimeBarExceedingTime' style={{ flexGrow: exceedingTime }}></div>}
            <div className={availableTimeClass}>{epBalancingLabelsService.stringToFloat( availableTime )}</div>
            {workContent < maxTotalTime && taktTime < maxTotalTime && <div className='aw-epBalancing-stationTileTotalTimeBarPlaceholder' style={{ flexGrow: placeholderSize }}></div>}
        </div>
    );
};

const renderNameAndCapacityContainer = ( vmoProps ) => {
    return (
        <div className='aw-epBalancing-stationTilePrNameAndCapacityContainer' title={'Name: ' + vmoProps.bl_rev_object_name.displayValues[0]}>
            {vmoProps.elb0sharedWithStations.dbValues && vmoProps.elb0sharedWithStations.dbValues.length > 1 && <AwIcon iconId='cmdShare24'></AwIcon>}
            <div className='aw-epBalancing-textEllipses aw-epBalancing-stationTileProcessResourceName'>{vmoProps.bl_rev_object_name.displayValues[0]}</div>
            {vmoProps.capacity.dbValues[0] && vmoProps.capacity.dbValues[0] < 100 && <div className='aw-epBalancing-stationTileProcessResourceCapacity'> | {parseInt( vmoProps.capacity.displayValues[0] )}%</div>}
        </div>
    );
};

const renderWorkTime = ( props ) => {
    return (
        <div className='aw-epBalancing-stationTileTotalTimeField' title={ balancingMessages.totalTime + ' ' + props.elb0workContentByPV.displayValues[0] + ' ' + timeUnits }>
            {props.elb0workContentByPV.displayValues[0]}
        </div>
    );
};
