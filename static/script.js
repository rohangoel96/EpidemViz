var fillInMissingDates = false;  //fill in missing dates in the data
var margin = {top: 0, right: 0, bottom: 20, left: 0};
var timeParseFormat = d3.time.format("%Y-%m-%d");
var timeDisplayFormat = d3.time.format("%d/%m/%y")
var divID1 = "#timeline-1"
var divID2 = "#timeline-2"

var mapDataSelector = "OFFICIAL"
var chartBoxWidth = 0;
var timeStartDate = -1;
var timeEndDate = -1;
var width;
var trimStartDate = -1
var trimEndDate = -1
var heatMapEnableBool = false;
var markers = new L.FeatureGroup();
var heatMap = new L.FeatureGroup();
var markersArray = []
var heatMapMarkers = []
var lasso = new FreeDraw({
    recreateAfterEdit: true,
    strokeWidth: 1,
    maximumPolygons : 1,
    leaveModeAfterCreate: true
}); //https://github.com/Wildhoney/Leaflet.FreeDraw

$(document).ready(function() {
    plotter();
    map = L.map('map').setView([20, 10], 1);
    map.on('zoomend', mapZoomHandler)

    map.addLayer(lasso);
    lasso.mode(FreeDraw.NONE)
    lasso.on('markers', event => {
        var lassoPointListofList = event.latLngs
        if(lassoPointListofList) {
            var lassoPolygonList = []
            lassoPointListofList.forEach(function(polygonList) {
                polygonList.forEach(function(latLng) {
                    lassoPolygonList.push([latLng.lat, latLng.lng])
                })
                var lassoPolygon = L.polygon(lassoPolygonList);
                // lassoPolygon.addTo(map)
                lassoHandler(lassoPolygon)
            })
        }
    });

    $(divID1).on('scroll', function () {$(divID2).scrollLeft($(this).scrollLeft());});
    $(divID2).on('scroll', function () {$(divID1).scrollLeft($(this).scrollLeft());});

});

function plotter() {
    var dsv = d3.dsv(";", "text/plain");

    dsv("/static/data/official.csv", function(error, officialData) {
        if (error) throw error;
        
        var dataType = $("input:radio[name=data-type]:checked").val();
        var processedOfficialData = processData(officialData, dataType);
        
        $(".entity-container").each(function(ind, div) {
            $(div).css("display", ($(div).attr("id") == "entity-" + dataType? "block" : "none"))
        })

        dsv("/static/data/un_official.csv", function(error, unofficialData) {
            if (error) throw error;
            var processedUnofficialData = processData(unofficialData, dataType);
            
            var combinedData = officialData.concat(unofficialData)
            var processedCombinedData = processData(combinedData, dataType);

            entityKeys = processedCombinedData[1]
            colorrange = generateDistinctColors(entityKeys.length)

            chartBoxWidth = $("#timeline-1").width() - margin.left - margin.right;

            var mapConfig = {
                combinedData: processedCombinedData[0],
                officialData: processedOfficialData[0],
                unofficialData: processedUnofficialData[0],
                colorrange: colorrange,
                entityKeys: entityKeys
            }

            drawTimeline({
                divID: divID1,
                data: processedOfficialData[0],
                margin: margin,
                width: chartBoxWidth,
                height: 135 - margin.top - margin.bottom,
                dataDateDict: processedOfficialData[2],
                dates : processedOfficialData[3],
                colorrange: colorrange,
                entityKeys: entityKeys,
                dataDateDictHover: {
                    official: processedOfficialData[2],
                    unofficial: processedUnofficialData[2]
                },
                mapConfig: mapConfig
            });

            drawTimeline({
                divID: divID2,
                data: processedUnofficialData[0],
                margin: margin,
                width: chartBoxWidth,
                height: 135 - margin.top - margin.bottom,
                dataDateDict: processedUnofficialData[2],
                dates : processedUnofficialData[3],
                colorrange: colorrange,
                entityKeys: entityKeys,
                dataDateDictHover: {
                    official: processedOfficialData[2],
                    unofficial: processedUnofficialData[2]
                },
                mapConfig: mapConfig
            });

            geoMapHandler(mapConfig, false)

            $(".data-file").change(function() {
                if($("#map-data-official").is(":checked") && $("#map-data-unofficial").is(":checked")) {
                    mapDataSelector = "BOTH";
                } else if ($("#map-data-official").is(":checked")){
                    mapDataSelector = "OFFICIAL"
                } else if ($("#map-data-unofficial").is(":checked")){
                    mapDataSelector = "UNOFFICIAL"
                } else {
                    mapDataSelector = "OFFICIAL"
                    $("#map-data-official").prop("checked", true)
                }
                geoMapHandler(mapConfig)
            });

            //update colors for entities
            $(".enties-label").css("color", "black")
            $( "label[id^='label_"+$("input:radio[name=data-type]:checked").val()+"']").each(function(ind, item) {
                $(this).css("color", colorrange[entityKeys.indexOf($(this).attr("id").split("_")[2])])
            })

        });
    
    });

}

function geoMapHandler(mapConfig, trimmingBool=true) {
    var entityKeys = mapConfig.entityKeys;
    var colorrange = mapConfig.colorrange;
    var data;

    if (mapDataSelector == "OFFICIAL") {
        data = mapConfig.officialData;
    } else if (mapDataSelector == "UNOFFICIAL"){
        data = mapConfig.unofficialData;
    } else {
        data = mapConfig.combinedData;
    }

    markers.clearLayers();
    heatMap.clearLayers();
    markersArray = []
    heatMapMarkers = []

    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        // attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
        noWrap: true,
        maxZoom: 8,
        minZoom: 1,
    }).addTo(map);

    if (heatMapEnableBool) {
        var dataLocationDict = {};
        var heatmapLocationData = [];
        var maxDataLocationCount = -1;

        data.forEach(function(item){
            var startDate;
            var endDate;
            if(trimmingBool){
                startDate = new Date(trimStartDate)
                endDate = new Date(trimEndDate)
                if (trimStartDate == -1) startDate = new Date(timeStartDate)
                if (trimEndDate == -1) endDate = new Date(timeEndDate)

            } else {
                startDate = new Date(timeStartDate)
                endDate = new Date(timeEndDate)
            }
            if (item.date >= startDate && item.date <= endDate && item.location.length > 0) {
                item.location.forEach(function(location) {
                    heatMapMarkers.push({
                        marker: L.circle(location, {}),
                        date: item.date,
                        reliability: item.reliability
                    })
                    var dataLocString = coordinateTupleToString(location)
                    if (dataLocString in dataLocationDict) {
                        dataLocationDict[dataLocString] += 1
                        maxDataLocationCount = Math.max(maxDataLocationCount, dataLocationDict[dataLocString])
                    } else {
                        dataLocationDict[dataLocString] = 1
                    }
                })
            }
        })

        for (dataLocString in dataLocationDict){
            var dataLocationTuple = stringToCoordinateTuple(dataLocString)
            heatmapLocationData.push([dataLocationTuple[0], dataLocationTuple[1], dataLocationDict[dataLocString]/maxDataLocationCount])
        }
        // https://github.com/Leaflet/Leaflet.heat
        var heat = L.heatLayer(heatmapLocationData, {
            radius: 10,
            minOpacity: 0.35,
            maxZoom: 5,
            blur: 7,
            max: 1,
            gradient: {0.1: "yellow", 0.3: 'red', 0.6: 'lime', 0.9: 'blue'},
        })
        heatMap.addLayer(heat)
        map.addLayer(heatMap)
    } else {
        data.forEach(function(item){
            var startDate;
            var endDate;
            if(trimmingBool){
                startDate = new Date(trimStartDate)
                endDate = new Date(trimEndDate)
                if (trimStartDate == -1) startDate = new Date(timeStartDate)
                if (trimEndDate == -1) endDate = new Date(timeEndDate)

            } else {
                startDate = new Date(timeStartDate)
                endDate = new Date(timeEndDate)
            }

            if (item.date >= startDate && item.date <= endDate && item.location.length > 0) {
                item.location.forEach(function(location) {
                    var circle = L.circle(location, {
                        color: colorrange[entityKeys.indexOf(item.key)],
                        fill: colorrange[entityKeys.indexOf(item.key)],
                        radius: giveRadiusForMarkersZoom()
                    }).bindPopup("Date: "+item.date.toISOString().split('T')[0]+"<br>Entity: "+item.key+"<br>Confidence: "+item.confidence);
                    markers.addLayer(circle);
                    markersArray.push({
                        marker: circle,
                        date: item.date,
                        key: item.key,
                        reliability: item.reliability
                    })
                })
            }
        })
        map.addLayer(markers);
    }

    lassoResetHandler()
}

function processData(data, dataType) {
    var species_host = [],
            diseases = [],
            symptoms = []
            dates = [],
            dataDateDict ={}, 
            keys = [];
    
    data.map(function(d) {
            species_host = species_host.concat(d.species.split(','));
            diseases = diseases.concat(d.diseases.split(','));
            symptoms = symptoms.concat(d.symptoms.split(','));
            dates.push(d.publication_date);
    });

    appendEntities("#entity-species", species_host, 'species_')
    appendEntities("#entity-diseases", diseases, 'diseases_')
    appendEntities("#entity-symptoms", symptoms, 'symptoms_')

    // default selection
    $('input[id^="disease"]').attr('checked', true);

    dates = _.uniq(dates)
    keys = []
    var noEntitySelected = false;
    //check if no entity selected => select all
    if (($('input[id^="'+dataType+'"]:checked')).length === 0) {noEntitySelected = true;}
    
    //disable selecting entities of other data-types
    $('.entities-checkbox').each(function() {
        if (dataType != this.value.split("_")[0]) {
            $(this).prop("disabled", true);
            $(this).prop("checked", false);
        } else {
            $(this).prop("disabled", false);
            if (noEntitySelected){
                $(this).prop("checked", true);
            }
        }
    })

    objList =  $('input[id^="'+dataType+'"]')    
    for (var i = objList.length - 1; i >= 0; i--) {
        if($(objList[i]).is(":checked")){
            keys.push(objList[i].name.split(""+dataType+"_")[1])
        }
    }
        
    if (fillInMissingDates){
        // calculate the minimum and the maximum dates
        // and then calculate and fill in the missing dates in between
        var minDate = new Date(dates.reduce(function (a, b) { return a < b ? a : b; }));
        var maxDate = new Date(dates.reduce(function (a, b) { return a > b ? a : b; }));
        
        //helper function for getDates()
        Date.prototype.addDays = function(days) {
            var dat = new Date(this.valueOf())
            dat.setDate(dat.getDate() + days);
            return dat;
        }

        //returns a list of dates between 2 dates
        function getDates(startDate, stopDate) {
            var localDateArray = new Array();
            var currentDate = startDate;
            localDateArray.push((new Date (currentDate)).toISOString().split('T')[0])
            while (currentDate <= stopDate) {
                currentDate = currentDate.addDays(1);
                localDateArray.push((new Date (currentDate)).toISOString().split('T')[0])
            }
            return localDateArray;
        }

        dates = getDates(minDate, maxDate);        
    } else {
        function dateSorter (a,b){
        // Turn your strings into dates, and then subtract them
        // to get a value that is either negative, positive, or zero.
            return new Date(a) - new Date(b);
        };

        dates.sort(dateSorter)
    }

    timeStartDate = dates[0]
    timeEndDate = dates[dates.length - 1]

    dates.forEach(function(date) {
        dataDateDict[date] = {}
        keys.forEach(function(key) {
            //default each value to zero
            dataDateDict[date][key] = {}
            dataDateDict[date][key]["value"] = 0
            dataDateDict[date][key]["location"] = []
        })
    })

    data.map(function(d) {
        d[dataType].split(',').forEach(function(key) {
            if (keys.indexOf(key) > -1) {
                //fill in the value
                dataDateDict[d.publication_date][key]["value"] += 1
                dataDateDict[d.publication_date][key]["location"].push([d.latitude, d.longitude])
                dataDateDict[d.publication_date][key]["confidence"] = d.confidence
                dataDateDict[d.publication_date][key]["reliability"] = d.rss_feed_reliability
            }
        })
    })

    dataList = []
    //add data in a sequence of dates
    for (date in dataDateDict) {
        for (key in dataDateDict[date]){
            var tuple = {
                "date": timeParseFormat.parse(date),
                "key": key,
                "value": +dataDateDict[date][key]["value"],
                "location": dataDateDict[date][key]["location"],
                "confidence": dataDateDict[date][key]["confidence"],
                "reliability": dataDateDict[date][key]["reliability"]
            }
            dataList.push(tuple)
        }
    } 
    return [dataList, keys, dataDateDict, dates]
}

function coordinateTupleToString(coordiante){
    return ""+coordiante[0]+"_"+coordiante[1]
}

function stringToCoordinateTuple(str){
    var tup = str.split("_")
    return [parseFloat(tup[0]), parseFloat(tup[1])]
}


//helper function to append entities into the left-pane
function appendEntities(containerID, objList, idText) {
    if(!($(containerID).find('input').length > 0)) {
        _.uniq(objList).forEach(function(item) {
                $(containerID).append(
                        $(document.createElement('label')).text(item)
                        .attr({
                            class: "enties-label",
                            id: "label_"+idText + item
                        })
                        .append(
                                $(document.createElement('input')).attr({
                                        id:    idText + item,
                                        name:  idText + item,
                                        value: idText + item,
                                        class: 'entities-checkbox',
                                        type:  'checkbox',
                                        onclick: 'plotter(this)'
                                })
                        )  
                );
        })
    }
}

function drawTimeline(config) {
    var margin = config.margin;
    width = config.width;
    var height = config.height;
    var data = config.data;
    var colorrange = config.colorrange;
    var divID = config.divID;
    var datearray = [];

    strokecolor = "#aaa";

    var tooltip1 = d3.select("body")
        .append("div")
        .attr("class", "remove tooltips")
        .attr("id", "tooltip1")
        .style("z-index", "20")
        .style("visibility", "hidden")
    
    var tooltip2 = d3.select("body")
        .append("div")
        .attr("class", "remove tooltips")
        .attr("id", "tooltip2")
        .style("z-index", "20")
        .style("visibility", "hidden")

    var x = d3.time.scale()
            .domain([new Date(timeStartDate), new Date(timeEndDate)])   
            .range([0, width]);

    var y = d3.scale.linear()
            .range([height-10, 0]);

    var z = d3.scale.ordinal()
            .range(colorrange);

    var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom")
            .tickFormat(timeDisplayFormat)
            .ticks(config.width/25)

    var stack = d3.layout.stack()
            .offset("silhouette")
            .values(function(d) { return d.values; })
            .x(function(d) { return d.date; })
            .y(function(d) { return d.value; });

    var nest = d3.nest()
            .key(function(d) { return d.key; });

    var area = d3.svg.area()
            .interpolate("basis")
            .x(function(d) { return x(d.date); })
            .y0(function(d) { return y(d.y0); })
            .y1(function(d) { return y(d.y0 + d.y); });

    d3.select(divID+" svg").remove();
    var svg = d3.select(divID).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var layers = stack(nest.entries(data));

    // x.domain(d3.extent(data, function(d) { return d.date; }));
    x.domain([new Date(timeStartDate), new Date(timeEndDate)]);
    y.domain([0, d3.max(data, function(d) { return d.y0 + d.y; })]);

    svg.selectAll(".layer")
        .data(layers)
        .enter().append("path")
        .attr("class", "layer")
        .attr("d", function(d) { return area(d.values); })
        .style("fill", function(d, i) { return z(i); });


    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    svg.selectAll(".tick text").each(function(d, i) {
        if (i%4 != 0){
            $(this).hide()
        }
    });

    svg.selectAll(".tick line").each(function(d, i) {
        if (i%2 != 0){
            $(this).attr("y2", "5")
        }
    });

    var streamValue1 = 0, streamValue2 = 0;
    var verticalHover = d3.select(divID1+" svg").append("line")
        .attr("class", "verticalHover")
        .attr("x1", 0)
        .attr("y1", 20)
        .attr("x2", 0)
        .attr("y2", config.height)
        .style("stroke-width", 3)
        .style("stroke-dasharray", ("5, 8"))
        .style("stroke", "#aaa")
        .style("fill", "none")
        .attr("opacity", 0)
        .attr("id", "vertical-hover-1")

    var verticalHover2 = d3.select(divID2+" svg").append("line")
        .attr("class", "verticalHover")
        .attr("x1", 0)
        .attr("y1", 20)
        .attr("x2", 0)
        .attr("y2", config.height)
        .style("stroke-width", 3)
        .style("stroke-dasharray", ("5, 8"))
        .style("stroke", "#aaa")
        .style("fill", "none")
        .attr("opacity", 0)
        .attr("id", "vertical-hover-2")

    svg.selectAll(".layer")
        .attr("opacity", 1)
        .on("mouseover", function(d, i) {
            d3.selectAll(".chart").selectAll(".layer").transition()
            .duration(250)
            .attr("opacity", function(d, j) {
                return j != i ? 0.25 : 1;
            })
        })
        .on("mousemove", function(d, i) {
            mouse = d3.mouse(this);
            mousex = mouse[0],
            mousey = mouse[1];
            var mouseDate = x.invert(d3.mouse(this)[0]).toISOString().split('T')[0];
            var nearestMouseDate = giveNearestDate(mouseDate, config.dates)

            streamValue1 = 0, streamValue2 = 0;
            if(config.dataDateDictHover["official"][nearestMouseDate]){
                streamValue1 = config.dataDateDictHover["official"][nearestMouseDate][d.key].value
            }

            if(config.dataDateDictHover["unofficial"][nearestMouseDate]){
                streamValue2 = config.dataDateDictHover["unofficial"][nearestMouseDate][d.key].value
            }
            
            var dateToXScale = d3.time.scale()
                .domain([new Date(timeStartDate), new Date(timeEndDate)])
                .range([0, width]);

            d3.select(this)
                .classed("hover", true)
                .attr("stroke", strokecolor)
                .attr("stroke-width", "0.5px"); 

            d3.selectAll(".verticalHover")
                .attr("x1", dateToXScale(new Date(nearestMouseDate)))
                .attr("x2", dateToXScale(new Date(nearestMouseDate)))
                .attr("opacity", "1");

            tooltip1.html( "<p style='font-size: 10px;'>" + d.key + ": <b>" + streamValue1 + "</b><br><span style='font-size: 9px; position: relative; top: -3px;'>" + timeDisplayFormat(new Date(nearestMouseDate)) + "</span></p>" ).style("visibility", "visible")
                .style("left", ($(divID1).offset().left + parseFloat($("#vertical-hover-1")[0].getBBox().x) - $(divID1).scrollLeft() + 10) +"px")
                .style("top", ($(divID1).offset().top + mousey - 50) +"px");

            tooltip2.html( "<p style='font-size: 10px;'>" + d.key + ": <b>" + streamValue2 + "</b><br><span style='font-size: 9px; position: relative; top: -3px;'>" + timeDisplayFormat(new Date(nearestMouseDate)) + "</span></p>" ).style("visibility", "visible")
                .style("left", (($(divID1).offset().left + parseFloat($("#vertical-hover-2")[0].getBBox().x) - $(divID2).scrollLeft() + 10)) +"px")
                .style("top", ($(divID2).offset().top + mousey - 50) +"px");
        })
        .on("mouseout", function(d, i) {
            d3.selectAll(".chart").selectAll(".layer")
                .transition()
                .duration(250)
                .attr("opacity", "1");

            tooltip1.html( "<p>" + d.key + "<br>" + streamValue1 + "</p>" ).style("visibility", "hidden");
            tooltip2.html( "<p>" + d.key + "<br>" + streamValue2 + "</p>" ).style("visibility", "hidden");
            
            d3.selectAll(".verticalHover").attr("opacity", "0");
        })

    var dragWhiteRect1 = d3.select(divID+" svg").append("rect")
          .attr("x", 0)
          .attr("y", margin.top)
          .attr("width", 0)
          .attr("height", config.height)
          .attr("opacity", 0.3)
          .attr("fill", "white")
          .attr("class", "drag-white-rect dragWhiteRectStart")

    var dragWhiteRect2 = d3.select(divID+" svg").append("rect")
          .attr("x", width)
          .attr("y", margin.top)
          .attr("width", 0)
          .attr("height", config.height)
          .attr("opacity", 0.3)
          .attr("fill", "white")
          .attr("class", "drag-white-rect dragWhiteRectEnd")

    var drag1 = d3.behavior.drag()
           .on('dragstart', null)
           .on('drag', function(d){
                var dx = d3.event.dx;
                var x1New = parseFloat(d3.select(this).attr('x1'))+ dx;
                var x2New = parseFloat(d3.select(this).attr('x2'))+ dx;
                if(x1New + 0.1*width < parseFloat(verticalDateEnd.attr('x1')) && x1New > 2){
                    d3.selectAll(".verticalDateStart").attr("x1", x1New).attr("x2", x2New)
                    d3.selectAll(".dragWhiteRectStart").attr("width", x1New - 2)
                        .attr("opacity", 0.3)
                }
                dragArrow.attr("visibility", "hidden")
             }).on('dragend', function(d){
                var mouseDate = x.invert(parseFloat(d3.select(this).attr('x1'))).toISOString().split('T')[0];
                trimStartDate = mouseDate;
                geoMapHandler(config.mapConfig)
                dragWhiteRect1.attr("opacity", 0.6)
                if (parseFloat(verticalDateEnd.attr("x1")) - parseFloat(verticalDateStart.attr("x1")) < 0.9*width) {
                    var newArrowX = (parseFloat(verticalDateStart.attr("x1")) + parseFloat(verticalDateEnd.attr("x1")))/2
                    d3.selectAll(".dragArrow").attr("visibility", "visibile").attr("x1", newArrowX-20).attr("x2", newArrowX+20)
                }
             }); 
               
    var drag2 = d3.behavior.drag()
       .on('dragstart', null)
       .on('drag', function(d){
            var dx = d3.event.dx;
            var x1New = parseFloat(d3.select(this).attr('x1'))+ dx;
            var x2New = parseFloat(d3.select(this).attr('x2'))+ dx;
            if(x1New > parseFloat(verticalDateStart.attr('x1')) + 0.1*width && x1New < width - 2){
                d3.selectAll(".verticalDateEnd").attr("x1", x1New).attr("x2", x2New)
                d3.selectAll(".dragWhiteRectEnd").attr("width", width - x2New)
                        .attr("x", x2New + 2)
                        .attr("opacity", 0.3)
            }
            dragArrow.attr("visibility", "hidden")
         }).on('dragend', function(d) {
            var mouseDate = x.invert(parseFloat(d3.select(this).attr('x1'))).toISOString().split('T')[0];
            trimEndDate = mouseDate;
            geoMapHandler(config.mapConfig);
            dragWhiteRect2.attr("opacity", 0.6)
            if (parseFloat(verticalDateEnd.attr("x1")) - parseFloat(verticalDateStart.attr("x1")) < 0.9*width) {
                var newArrowX = (parseFloat(verticalDateStart.attr("x1")) + parseFloat(verticalDateEnd.attr("x1")))/2
                d3.selectAll(".dragArrow").attr("visibility", "visibile").attr("x1", newArrowX-20).attr("x2", newArrowX+20)
            }
         });

    var drag3 = d3.behavior.drag()
        .on('dragstart', null)
        .on('drag', function(d){
            var dx = d3.event.dx;
            var dragStartNew = parseFloat(verticalDateStart.attr('x1')) + dx
            var dragRectEndNew = parseFloat(verticalDateEnd.attr('x1')) + dx
            var dragArrowNew = parseFloat(dragArrow.attr('x1')) + dx
            if (dragStartNew > 2 && dragRectEndNew < width-2) {
                d3.selectAll(".dragArrow").attr('x1', dragArrowNew).attr("x2", dragArrowNew + 40)
                d3.selectAll(".verticalDateStart").attr("x1", dragStartNew).attr("x2", dragStartNew);
                d3.selectAll(".verticalDateEnd").attr("x1", dragRectEndNew).attr("x2", dragRectEndNew);
                d3.selectAll(".dragWhiteRectStart").attr("width", dragStartNew - 2)
                        .attr("opacity", 0.3)
                d3.selectAll(".dragWhiteRectEnd").attr("width", width - dragRectEndNew)
                        .attr("x", dragRectEndNew + 2)
                        .attr("opacity", 0.3)
            }
        }).on('dragend', function(d) {
            d3.selectAll(".dragWhiteRectStart").attr("opacity", 0.6)
            d3.selectAll(".dragWhiteRectEnd").attr("opacity", 0.6)
            trimStartDate = x.invert(parseFloat(verticalDateStart.attr('x1'))).toISOString().split('T')[0];
            trimEndDate = x.invert(parseFloat(verticalDateEnd.attr('x1'))).toISOString().split('T')[0];
            geoMapHandler(config.mapConfig);
        }); 
           

    var verticalDateStart = svg.append("line")
            .attr("class", "date-select-line verticalDateStart")
            .attr("x1", 2)
            .attr("y1", 20)
            .attr("x2", 2)
            .attr("y2", config.height)
            .style("stroke-width", 4)
            .style("stroke", "black")
            .style("fill", "none")
            .call(drag1);

    var verticalDateEnd = svg.append("line")
            .attr("class", "date-select-line verticalDateEnd")
            .attr("x1", width-2)
            .attr("y1", 20)
            .attr("x2", width-2)
            .attr("y2", config.height)
            .style("stroke-width", 4)
            .style("stroke", "black")
            .style("fill", "none")
            .call(drag2);

    d3.select(divID+" svg").append("marker")
        .attr({
            "id":"arrow-head",
            "viewBox":"0 0 10 10",
            "refX":-0.35,
            "refY":5,
            "markerWidth":3,
            "markerHeight":3,
            "orient":"auto",
            "fill":"#aaa",
        })
        .append("path")
        .attr("d", "M 0 3 L 3 5 L 0 7 z")
        .attr("class","arrow");

    d3.select(divID+" svg").append("marker")
        .attr({
            "id":"arrow-head-2",
            "viewBox":"0 0 10 10",
            "refX":8.35,
            "refY":5,
            "markerWidth":3,
            "markerHeight":3,
            "orient": "auto",
            "fill": "#aaa"
        })
        .append("path")
        .attr("d", "M 5 5 L 8 3 L 8 7 z")
        .attr("class","arrow");

    var dragArrow = d3.select(divID+" svg").append("line")
          .attr("x1", 0)
          .attr("y1", config.height - 15)
          .attr("x2", 0)
          .attr("y2", config.height - 15)
          .attr("opacity", 1)
          .style("stroke-width", 7)
          .style("stroke", "#aaa")
          .attr("fill", "#aaa")
          .attr("class", "drag-arrow dragArrow")
          .call(drag3)
          .attr("marker-end", "url(#arrow-head)")
          .attr("marker-start", "url(#arrow-head-2)")
          .attr("visibility", "hidden")
          .on("click", null)
          .on("dblclick",function(){
                geoMapHandler(config.mapConfig)
                d3.selectAll(".dragWhiteRectStart").attr("width", 0)
                d3.selectAll(".dragWhiteRectEnd").attr("width", 0).attr("x", width) 
                d3.selectAll(".verticalDateStart").attr("x1", 2).attr("x2", 2)
                d3.selectAll(".verticalDateEnd").attr("x1", width-2).attr("x2", width-2)
                d3.selectAll(".dragArrow").attr("visibility", "hidden")
          });

    if(divID == "#timeline-1"){
        $("#zoom-in-1").unbind('click').bind('click', function(e, triggered) { 
            zoomInHandler(config);
            if(!triggered){$("#zoom-in-2").trigger('click', true);}
        });
        $("#zoom-out-1").unbind('click').bind('click', function(e, triggered) { 
            zoomOutHandler(config);
            if(!triggered){$("#zoom-out-2").trigger('click', true);}
        });
    } else {
        $("#zoom-in-2").unbind('click').bind('click', function(e, triggered) { 
            zoomInHandler(config);
            if(!triggered){$("#zoom-in-1").trigger('click', true);}
        });
        $("#zoom-out-2").unbind('click').bind('click', function(e, triggered) { 
            zoomOutHandler(config);
            if(!triggered){$("#zoom-out-1").trigger('click', true);}
        });
    }
    d3.select("#color-scheme").on("change", function() { colorSchemeHandler(config); });
}

function zoomInHandler(config){
    if (config.width * 1.2 > chartBoxWidth * 5) {
        config.width = config.width;
    } else {
        config.width *= 1.2;
    }
    drawTimeline(config);
    lassoResetHandler();
}

function zoomOutHandler(config){
    if (config.width / 1.2 < chartBoxWidth) {
        config.width = chartBoxWidth;
    } else {
        config.width /= 1.2;
    }
    drawTimeline(config);
    lassoResetHandler();
}

function colorSchemeHandler(config){
    config.color = d3.select("#color-scheme").node().value;
    drawTimeline(config);
}

function lassoHandler(lassoPolygon){
    // or check if a point is inside the selected path
    var items = []
    if(heatMapEnableBool){
        heatMapMarkers.forEach(function(item) {
            if (lassoPolygon.getBounds().contains(item.marker._latlng)) {
                items.push(item)
            }
        })
    } else {
        markersArray.forEach(function(item) {
            if (lassoPolygon.getBounds().contains(item.marker._latlng)) {
                items.push(item)
            }
        })
    }
    lassoTimelineHighlight(items)
}

function lassoEnableHandler(){
    if ($("#lasso-enable a")[0].text == "Enable") {
        lasso.mode(FreeDraw.CREATE + FreeDraw.EDIT);
        $("#lasso-enable a")[0].text = "Disable"
    } else {
        lasso.mode(FreeDraw.NONE);
        lasso.clear();
        d3.selectAll(".chart svg").selectAll(".date-lasso-line").remove()
        $("#lasso-enable a")[0].text = "Enable"
    }
}

function lassoResetHandler() {
    lasso.clear();
    d3.selectAll(".chart svg").selectAll(".date-lasso-line").remove()
    map.setView([20, 10], 1)

    if ($("#lasso-enable a")[0].text == "Disable") {
        lasso.mode(FreeDraw.CREATE + FreeDraw.EDIT);
    } else {
        lasso.mode(FreeDraw.NONE);
    }
}

function lassoTimelineHighlight(items){
    d3.selectAll(".chart svg").selectAll(".date-lasso-line").remove()
    var svg1 = d3.select(divID1+" svg");
    var svg2 = d3.select(divID2+" svg");
    var x = d3.time.scale()
            .domain([new Date(timeStartDate), new Date(timeEndDate)])
            .range([0, width]);

    items.forEach(function(item){
        if(item.reliability == "official"){
            svg1.append("line")
                .attr("class", "date-lasso-line")
                .attr("x1", margin.left + x(new Date(item.date)))
                .attr("y1", margin.top + 20)
                .attr("x2", margin.left + x(new Date(item.date)))
                .attr("y2", 115)
                .style("stroke-width", 1)
                .style("stroke-dasharray", ("8, 8"))
                .style("stroke",item.key ? colorrange[entityKeys.indexOf(item.key)]: "#aaa")
                .style("fill", "none");
        } else if (item.reliability == "unofficial"){
            svg2.append("line")
                .attr("class", "date-lasso-line")
                .attr("x1", margin.left + x(new Date(item.date)))
                .attr("y1", margin.top + 20)
                .attr("x2", margin.left + x(new Date(item.date)))
                .attr("y2", 115)
                .style("stroke-width", 1)
                .style("stroke-dasharray", ("8, 8"))
                .style("stroke",item.key ? colorrange[entityKeys.indexOf(item.key)]: "#aaa")
                .style("fill", "none");
        } else {
            console.log("rss_reliability error")
        }
    })
}

function giveNearestDate(mouseDate, datesArr){
    var minDateDiff = new Date(datesArr[0]);
    datesArr.forEach(function (item) {
        if(Math.abs(new Date(mouseDate) - new Date(item)) < Math.abs(new Date(mouseDate) - new Date(minDateDiff))){
            minDateDiff = item;
        }
    })
    return minDateDiff;
}

function mapZoomHandler() {
    markersArray.forEach(function(item) {
        item.marker.setRadius(giveRadiusForMarkersZoom())
        markers.addLayer(item.marker)
    })
}

function heatMapHandler(item) {
    heatMapEnableBool = !heatMapEnableBool;    
    plotter();
    lasso.clear();
    d3.select(divID1+' svg').selectAll('.date-lasso-line').remove();
    if(heatMapEnableBool){
        d3.select(item).html("See Points")
    } else {
        d3.select(item).html("See HeatMap")
    }
}

function giveRadiusForMarkersZoom(){
    var currentZoom = map.getZoom();
    var radiusMultiplier;

    if (currentZoom <=1){ 
        radiusMultiplier = 1
    } else if (currentZoom <= 3) {
        radiusMultiplier = currentZoom + 2; 
    } else if (currentZoom <= 7) {
        radiusMultiplier = currentZoom + 1;
    } else { 
        radiusMultiplier = 8;
    }
    return 5000 * radiusMultiplier;
}