$(document).ready(function() {
    plotter();
    map = L.map('map').setView([45, 0], 1);
    map.on('zoomend', mapZoomHandler)
    lasso = L.lassoSelect({
        activeTooltip:"Click to start the lasso selection",
        startedTooltip:"Select more points",
        readyTooltip:"Complete a loop of the lasso selection",
        finishedTooltip: "Completed Lasso Selection"
    }).addTo(map);
    lasso.on('pathchange', lassoHandler);
});
var markers = new L.FeatureGroup();
var markersArray = []
var fillInMissingDates = false;  //fill in missing dates in the data
var margin = {top: 0, right: 0, bottom: 20, left: 0};
var format = d3.time.format("%Y-%m-%d");
var chartBoxWidth = 0;
var timeStartDate = -1;
var timeEndDate = -1;
var width;
var trimStartDate = -1
var trimEndDate = -1

function plotter() {
    var dsv = d3.dsv(";", "text/plain");
    dsv("/static/data/"+$("input:radio[name=data-file]:checked").val()
        +".csv", function(error, data) {
            if (error) throw error;
            
            processedOut = processData(data, $("input:radio[name=data-type]:checked").val());
            
            var processedDataList = processedOut[0]
            entityKeys = processedOut[1]
            colorrange = generateDistinctColors(entityKeys.length)

            processedDataList.forEach(function(d) {
                d.date = format.parse(d.date);
                d.value = +d.value;
                d.key = d.key;
            });

            chartBoxWidth = $("#timeline").width() - margin.left - margin.right;
            var config = {
                data: processedDataList,
                colorrange: colorrange,
                margin: margin,
                width: chartBoxWidth,
                entityKeys: entityKeys,
                height: 250 - margin.top - margin.bottom,
                dataDateDict: processedOut[2],
                dates : processedOut[3]
            }

            mapUpdate(config);
            chart(config);

            //update colors for entities
            $(".enties-label").css("color", "black")
            $( "label[id^='label_"+$("input:radio[name=data-type]:checked").val()+"']").each(function(ind, item) {
                $(this).css("color", colorrange[entityKeys.indexOf($(this).attr("id").split("_")[2])])
            })
    });
}

function mapUpdate(config, trimmingBool=false) {
    var data = config.data;
    var entityKeys = config.entityKeys;
    var colorrange = config.colorrange;

    markers.clearLayers();
    markersArray = []

    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

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

        if (item.date >= startDate && item.date <= endDate) {
            if (item.location.length > 0) {
                item.location.forEach(function(location) {
                    var circle = L.circle(location, {
                        color: colorrange[entityKeys.indexOf(item.key)],
                        fill: colorrange[entityKeys.indexOf(item.key)],
                        radius: 5000
                    }).bindPopup("Date: "+item.date.toISOString().split('T')[0]+"<br>Entity: "+item.key+"<br>Confidence: "+item.confidence);
                    markers.addLayer(circle);
                    markersArray.push({
                        marker: circle,
                        date: item.date,
                        key: item.key
                    })
                })
            }
        }
    })
    map.addLayer(markers);
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

    appendEntities("#entity-host", species_host, 'species_')
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
            }
        })
    })

    dataList = []
    //add data in a sequence of dates
    for (date in dataDateDict) {
        for (key in dataDateDict[date]){
            var tuple = {
                "date": date,
                "key": key,
                "value": dataDateDict[date][key]["value"],
                "location": dataDateDict[date][key]["location"],
                "confidence": dataDateDict[date][key]["confidence"]
            }
            dataList.push(tuple)
        }
    } 

    return [dataList, keys, dataDateDict, dates]
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

function chart(config) {
    var margin = config.margin;
    width = config.width;
    var height = config.height;
    var data = config.data;
    var colorrange = config.colorrange;
    var dataDateDict = config.dataDateDict;
    var datearray = [];

    strokecolor = colorrange[0];

    var tooltip = d3.select("body")
            .append("div")
            .attr("class", "remove")
            .attr("id", "tooltip")
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
            .tickFormat(d3.time.format("%d/%m/%y"))
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

    d3.select(".chart svg").remove();
    var svg = d3.select(".chart").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var layers = stack(nest.entries(data));

    x.domain(d3.extent(data, function(d) { return d.date; }));
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

    var streamValue = 0;
    var verticalHover = svg.append("line")
        .attr("class", "verticalHover")
        .attr("x1", 0)
        .attr("y1", 20)
        .attr("x2", 0)
        .attr("y2", config.height)
        .style("stroke-width", 3)
        .style("stroke-dasharray", ("5, 8"))
        .style("stroke", "#aaa")
        .style("fill", "none")

    svg.selectAll(".layer")
        .attr("opacity", 1)
        .on("mouseover", function(d, i) {
            svg.selectAll(".layer").transition()
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

            var streamValue = dataDateDict[nearestMouseDate][d.key].value
            var dateToXScale = d3.time.scale()
                .domain([new Date(timeStartDate), new Date(timeEndDate)])
                .range([0, width]);

            d3.select(this)
                .classed("hover", true)
                .attr("stroke", strokecolor)
                .attr("stroke-width", "0.5px"); 

            verticalHover
                .attr("x1", dateToXScale(new Date(nearestMouseDate)))
                .attr("x2", dateToXScale(new Date(nearestMouseDate)))
                .attr("opacity", "1");

            tooltip.html( "<p>" + d.key + ": <b>" + streamValue + "</b><br><span style='font-size: 12px; position: relative; top: -3px;'>" + nearestMouseDate + "</span></p>" ).style("visibility", "visible")
                .style("left", ($("#timeline").offset().left + dateToXScale(new Date(nearestMouseDate)) + 10) +"px")
                .style("top", ($("#timeline").offset().top + mousey - 70) +"px");
        })
        .on("mouseout", function(d, i) {
            svg.selectAll(".layer")
                .transition()
                .duration(250)
                .attr("opacity", "1");
            d3.select(this)
                .classed("hover", false)
                .attr("stroke-width", "0px"), tooltip.html( "<p>" + d.key + "<br>" + streamValue + "</p>" ).style("visibility", "hidden");
            verticalHover.attr("opacity", "0");
        })


    var dragWhiteRect1 = d3.select(".chart svg").append("rect")
          .attr("x", 0)
          .attr("y", margin.top)
          .attr("width", 0)
          .attr("height", config.height)
          .attr("opacity", 0.3)
          .attr("fill", "white")
          .attr("class", "drag-white-rect")

    var dragWhiteRect2 = d3.select(".chart svg").append("rect")
          .attr("x", width)
          .attr("y", margin.top)
          .attr("width", 0)
          .attr("height", config.height)
          .attr("opacity", 0.3)
          .attr("fill", "white")
          .attr("class", "drag-white-rect")

    var drag1 = d3.behavior.drag()
           .on('dragstart', null)
           .on('drag', function(d){
                var dx = d3.event.dx;
                var x1New = parseFloat(d3.select(this).attr('x1'))+ dx;
                var x2New = parseFloat(d3.select(this).attr('x2'))+ dx;
                if(x1New + 0.1*width < parseFloat(verticalDateEnd.attr('x1')) && x1New > 2){
                    verticalDateStart.attr("x1", x1New).attr("x2", x2New)
                    dragWhiteRect1.attr("width", x1New - 2)
                        .attr("opacity", 0.3)
                }
                dragArrow.attr("visibility", "hidden")
             }).on('dragend', function(d){
                var mouseDate = x.invert(parseFloat(d3.select(this).attr('x1'))).toISOString().split('T')[0];
                trimStartDate = mouseDate;
                mapUpdate(config, true)
                dragWhiteRect1.attr("opacity", 0.6)
                if (parseFloat(verticalDateEnd.attr("x1")) - parseFloat(verticalDateStart.attr("x1")) < 0.9*width) {
                    var newArrowX = (parseFloat(verticalDateStart.attr("x1")) + parseFloat(verticalDateEnd.attr("x1")))/2
                    dragArrow.attr("visibility", "visibile").attr("x1", newArrowX-20).attr("x2", newArrowX+20)
                }
             }); 
               
    var drag2 = d3.behavior.drag()
       .on('dragstart', null)
       .on('drag', function(d){
            var dx = d3.event.dx;
            var x1New = parseFloat(d3.select(this).attr('x1'))+ dx;
            var x2New = parseFloat(d3.select(this).attr('x2'))+ dx;
            if(x1New > parseFloat(verticalDateStart.attr('x1')) + 0.1*width && x1New < width - 2){
                verticalDateEnd.attr("x1", x1New).attr("x2", x2New)
                dragWhiteRect2.attr("width", width - x2New)
                        .attr("x", x2New + 2)
                        .attr("opacity", 0.3)
            }
            dragArrow.attr("visibility", "hidden")
         }).on('dragend', function(d) {
            var mouseDate = x.invert(parseFloat(d3.select(this).attr('x1'))).toISOString().split('T')[0];
            trimEndDate = mouseDate;
            mapUpdate(config, true);
            dragWhiteRect2.attr("opacity", 0.6)
            if (parseFloat(verticalDateEnd.attr("x1")) - parseFloat(verticalDateStart.attr("x1")) < 0.9*width) {
                var newArrowX = (parseFloat(verticalDateStart.attr("x1")) + parseFloat(verticalDateEnd.attr("x1")))/2
                dragArrow.attr("visibility", "visibile").attr("x1", newArrowX-20).attr("x2", newArrowX+20)
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
                dragArrow.attr('x1', dragArrowNew).attr("x2", dragArrowNew + 50)
                verticalDateStart.attr("x1", dragStartNew).attr("x2", dragStartNew);
                verticalDateEnd.attr("x1", dragRectEndNew).attr("x2", dragRectEndNew);
                dragWhiteRect1.attr("width", dragStartNew - 2)
                        .attr("opacity", 0.3)
                dragWhiteRect2.attr("width", width - dragRectEndNew)
                        .attr("x", dragRectEndNew + 2)
                        .attr("opacity", 0.3)
            }
        }).on('dragend', function(d) {
            dragWhiteRect1.attr("opacity", 0.6)
            dragWhiteRect2.attr("opacity", 0.6)
            trimStartDate = x.invert(parseFloat(verticalDateStart.attr('x1'))).toISOString().split('T')[0];
            trimEndDate = x.invert(parseFloat(verticalDateEnd.attr('x1'))).toISOString().split('T')[0];
            mapUpdate(config, true);
        }); 
           

    var verticalDateStart = svg.append("line")
            .attr("class", "date-select-line")
            .attr("x1", 2)
            .attr("y1", 20)
            .attr("x2", 2)
            .attr("y2", config.height)
            .style("stroke-width", 4)
            .style("stroke", "black")
            .style("fill", "none")
            .call(drag1);

    var verticalDateEnd = svg.append("line")
            .attr("class", "date-select-line")
            .attr("x1", width-2)
            .attr("y1", 20)
            .attr("x2", width-2)
            .attr("y2", config.height)
            .style("stroke-width", 4)
            .style("stroke", "black")
            .style("fill", "none")
            .call(drag2);

    d3.select(".chart svg").append("marker")
        .attr({
            "id":"arrow-head",
            "viewBox":"0 0 10 10",
            "refX":-0.35,
            "refY":5,
            "markerWidth":3,
            "markerHeight":3,
            "orient":"auto"
        })
        .append("path")
        .attr("d", "M 0 3 L 3 5 L 0 7 z")
        .attr("class","arrow");

    d3.select(".chart svg").append("marker")
        .attr({
            "id":"arrow-head-2",
            "viewBox":"0 0 10 10",
            "refX":8.35,
            "refY":5,
            "markerWidth":3,
            "markerHeight":3,
            "orient": "auto"
        })
        .append("path")
        .attr("d", "M 5 5 L 8 3 L 8 7 z")
        .attr("class","arrow");

    var dragArrow = d3.select(".chart svg").append("line")
          .attr("x1", 0)
          .attr("y1", config.height - 30)
          .attr("x2", 0)
          .attr("y2", config.height - 30)
          .attr("opacity", 1)
          .style("stroke-width", 15)
          .style("stroke", "black")
          .attr("fill", "red")
          .attr("class", "drag-arrow")
          .call(drag3)
          .attr("marker-end", "url(#arrow-head)")
          .attr("marker-start", "url(#arrow-head-2)")
          .attr("visibility", "hidden")
          .on("click", null)
          .on("dblclick",function(){
                mapUpdate(config)
                dragWhiteRect1.attr("width", 0)
                dragWhiteRect2.attr("width", 0).attr("x", width) 
                verticalDateStart.attr("x1", 2).attr("x2", 2)
                verticalDateEnd.attr("x1", width-2).attr("x2", width-2)
                dragArrow.attr("visibility", "hidden")
          });


    d3.select("#zoom-in").on("click", function() { zoomInHandler(config); });
    d3.select("#zoom-out").on("click", function() { zoomOutHandler(config); });
    d3.select("#color-scheme").on("change", function() { colorSchemeHandler(config); });
}

function zoomInHandler(config){
    if (config.width * 1.2 > chartBoxWidth * 5) {
        config.width = config.width;
    } else {
        config.width *= 1.2;
    }
    chart(config);
    mapUpdate(config);
}

function zoomOutHandler(config){
    if (config.width / 1.2 < chartBoxWidth) {
        config.width = chartBoxWidth;
    } else {
        config.width /= 1.2;
    }
    chart(config);
    mapUpdate(config);
}

function colorSchemeHandler(config){
    config.color = d3.select("#color-scheme").node().value;
    chart(config);
}

function lassoHandler(){
    var path = lasso.getPath();
    // or check if a point is inside the selected path
    var items = []
    markersArray.forEach(function(item) {
    if (lasso.contains(item.marker.getLatLng())) {
        items.push(item)
        }
    })
    lassoTimelineHighlight(items)
}

function lassoEnableHandler(item){
    if ($("#lasso-enable a")[0].text == "Enable") {
        lasso.enable();
        $("#lasso-enable a")[0].text = "Disable"
    } else {
        lasso.disable();
        d3.select(".chart svg").selectAll(".date-lasso-line").remove()
        $("#lasso-enable a")[0].text = "Enable"
    }
}

function lassoTimelineHighlight(items){
    var svg = d3.select(".chart svg");
    var x = d3.time.scale()
            .domain([new Date(timeStartDate), new Date(timeEndDate)])
            .range([0, width]);

    items.forEach(function(item){
        svg.append("line")
            .attr("class", "date-lasso-line")
            .attr("x1", margin.left + x(new Date(item.date)))
            .attr("y1", margin.top + 20)
            .attr("x2", margin.left + x(new Date(item.date)))
            .attr("y2", 228)
            .style("stroke-width", 2)
            .style("stroke", colorrange[entityKeys.indexOf(item.key)])
            .style("fill", "none");
    })
}

function lassoResetHandler(item) {
    lasso.reset();
    d3.select('.chart svg').selectAll('.date-lasso-line').remove();
    map.setView([45, 0], 1)

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
    
    markersArray.forEach(function(item) {
        item.marker.setRadius(5000 * radiusMultiplier)
        markers.addLayer(item.marker)
    })
}