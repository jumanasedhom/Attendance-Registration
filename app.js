// ==========================================
// GOOGLE APPS SCRIPT URL
// ==========================================

const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycby7SbhJwCMjped9GF48ykzn_rkSO-sIaMQ7vLpVLOVDBz41d_qrYD2o6SelkE6mO4Ve/exec";



// ==========================================
// LOCAL DATA
// ==========================================

let students =
    JSON.parse(
        localStorage.getItem(
            "students"
        )
    ) || [];


let attendance =
    JSON.parse(
        localStorage.getItem(
            "attendance"
        )
    ) || [];


let pendingAttendance =
    JSON.parse(
        localStorage.getItem(
            "pendingAttendance"
        )
    ) || [];


let selectedGrade =
    "Grade 3";



// ==========================================
// ELEMENTS
// ==========================================

const codeInput =
    document.getElementById(
        "studentCode"
    );


const attendanceButton =
    document.getElementById(
        "attendanceButton"
    );


const message =
    document.getElementById(
        "message"
    );


const attendanceCount =
    document.getElementById(
        "attendanceCount"
    );


const totalStudents =
    document.getElementById(
        "totalStudents"
    );


const presentStudents =
    document.getElementById(
        "presentStudents"
    );


const absentStudents =
    document.getElementById(
        "absentStudents"
    );


const gradeButtons =
    document.querySelectorAll(
        ".grade-button"
    );


const syncStatus =
    document.getElementById(
        "syncStatus"
    );

const removeAttendanceButton =
    document.getElementById(
        "removeAttendanceButton"
    );

// ==========================================
// DATE
// ==========================================

function getToday() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    return (
        `${year}-${month}-${day}`
    );
}



// ==========================================
// GRADE
// ==========================================

function getGradeFromCode(
    code
) {

    const firstDigit =
        String(code).charAt(0);


    const grades = {

        "3": "Grade 3",

        "4": "Grade 4",

        "5": "Grade 5",

        "6": "Grade 6"

    };


    return (
        grades[firstDigit]
        ||
        null
    );
}



// ==========================================
// SAVE
// ==========================================

function saveLocalData() {

    localStorage.setItem(
        "students",
        JSON.stringify(
            students
        )
    );


    localStorage.setItem(
        "attendance",
        JSON.stringify(
            attendance
        )
    );


    localStorage.setItem(
        "pendingAttendance",
        JSON.stringify(
            pendingAttendance
        )
    );
}



// ==========================================
// JSONP REQUEST
// ==========================================

function jsonpRequest(
    params
) {

    return new Promise(
        (resolve, reject) => {


            const callbackName =
                "__attendanceCallback_"
                +
                Date.now()
                +
                "_"
                +
                Math.floor(
                    Math.random()
                    * 100000
                );


            const script =
                document.createElement(
                    "script"
                );


            const url =
                new URL(
                    APPS_SCRIPT_URL
                );


            Object.entries(
                params
            ).forEach(
                ([key, value]) => {

                    url.searchParams
                        .set(
                            key,
                            value
                        );

                }
            );


            url.searchParams
                .set(
                    "callback",
                    callbackName
                );


            const timeout =
                setTimeout(
                    function() {

                        cleanup();

                        reject(
                            new Error(
                                "Request timeout"
                            )
                        );

                    },
                    12000
                );


            function cleanup() {

                clearTimeout(
                    timeout
                );


                delete window[
                    callbackName
                ];


                if (
                    script.parentNode
                ) {

                    script.parentNode
                        .removeChild(
                            script
                        );
                }
            }


            window[
                callbackName
            ] =
                function(data) {

                    cleanup();

                    resolve(data);

                };


            script.onerror =
                function() {

                    cleanup();

                    reject(
                        new Error(
                            "Network error"
                        )
                    );

                };


            script.src =
                url.toString();


            document.head
                .appendChild(
                    script
                );

        }
    );
}



// ==========================================
// STATUS
// ==========================================

function setSyncStatus(
    text,
    type = ""
) {

    syncStatus.textContent =
        text;


    syncStatus.className =
        "sync-status "
        +
        type;
}



// ==========================================
// DOWNLOAD SHEET DATA
// ==========================================

async function syncFromSheet() {

    if (
        !navigator.onLine
    ) {

        setSyncStatus(
            "Offline - Using saved data",
            "offline"
        );

        return;
    }


    try {

        setSyncStatus(
            "Syncing...",
            "syncing"
        );


        const today =
            getToday();


        const response =
            await jsonpRequest({

                action:
                    "snapshot",

                date:
                    today

            });


        if (
            !response.success
        ) {

            throw new Error(
                response.message
            );
        }


        students =
            response.students
                .map(
                    student => ({

                        code:
                            String(
                                student.code
                            ),

                        name:
                            student.name,

                        grade:
                            student.grade

                    })
                );


        const otherDays =
            attendance.filter(
                record =>
                    record.date
                    !== today
            );


        const sheetAttendance =
            response.students

                .filter(
                    student =>
                        student.present
                )

                .map(
                    student => ({

                        code:
                            String(
                                student.code
                            ),

                        name:
                            student.name,

                        grade:
                            student.grade,

                        date:
                            today

                    })
                );


        const pendingToday =
            pendingAttendance

                .filter(
                    record =>
                        record.date
                        === today
                );


        const attendanceMap =
            new Map();


        [
            ...sheetAttendance,
            ...pendingToday
        ]
            .forEach(
                record => {

                    attendanceMap.set(
                        String(
                            record.code
                        ),
                        record
                    );

                }
            );


        attendance = [

            ...otherDays,

            ...attendanceMap
                .values()

        ];


        saveLocalData();


        refreshUI();


        setSyncStatus(
            "Synced",
            "online"
        );

    } catch (error) {

        console.error(
            error
        );


        setSyncStatus(
            "Using offline data",
            "offline"
        );
    }
}



// ==========================================
// UPLOAD OFFLINE ATTENDANCE
// ==========================================

async function syncPendingAttendance() {

    if (
        !navigator.onLine
        ||
        pendingAttendance.length
        === 0
    ) {

        return;
    }


    const remaining = [];


    for (
        const record
        of pendingAttendance
    ) {

        try {

            const response =
                await jsonpRequest({

                    action:
                        "register",

                    code:
                        record.code,

                    date:
                        record.date

                });


            if (
                !response.success
            ) {

                throw new Error(
                    response.message
                );
            }

        } catch (error) {

            console.error(
                error
            );


            remaining.push(
                record
            );

        }

    }


    pendingAttendance =
        remaining;


    saveLocalData();
}



// ==========================================
// COMPLETE SYNC
// ==========================================

async function runSync() {

    if (
        !navigator.onLine
    ) {

        setSyncStatus(
            "Offline - Attendance will sync later",
            "offline"
        );

        return;
    }


    await syncPendingAttendance();

    await syncFromSheet();
}



// ==========================================
// REGISTER ATTENDANCE
// ==========================================

function registerAttendance() {

    const code =
        codeInput.value.trim();


    if (!code) {

        showError(
            "Please Enter The Code"
        );

        return;
    }


    if (
        !/^[3456]\d{3}$/
            .test(code)
    ) {

        showError(
            "Invalid Code"
        );

        clearInput();

        return;
    }


    const student =
        students.find(
            student =>
                String(
                    student.code
                )
                === code
        );


    if (!student) {

        showError(
            "The Code Is Not Found"
        );

        clearInput();

        return;
    }


    const today =
        getToday();


    const alreadyRegistered =
        attendance.some(
            record =>

                String(
                    record.code
                )
                === code

                &&

                record.date
                === today
        );


    if (
        alreadyRegistered
    ) {

        showError(
            `${student.name}
            - Attendance Already Registered`
        );

        clearInput();

        return;
    }


    const record = {

        code:
            code,

        name:
            student.name,

        grade:
            student.grade
            ||
            getGradeFromCode(
                code
            ),

        date:
            today

    };


    attendance.push(
        record
    );


    const alreadyPending =
        pendingAttendance.some(
            pending =>

                pending.code
                === code

                &&

                pending.date
                === today
        );


    if (
        !alreadyPending
    ) {

        pendingAttendance.push(
            record
        );

    }


    saveLocalData();


    message.innerHTML = `

        <div class="success">

            ${student.name}

            <br>

            Attendance Registered Successfully

            ${
                navigator.onLine
                ?
                ""
                :
                "<br>Saved Offline"
            }

        </div>

    `;


    clearInput();


    refreshUI();


    if (
        navigator.onLine
    ) {

        runSync();

    }
}

async function removeAttendance() {

    const code =
        codeInput.value.trim();


    if (!code) {

        showError(
            "Please Enter The Code"
        );

        return;
    }


    if (
        !/^[3456]\d{3}$/.test(code)
    ) {

        showError(
            "Invalid Code"
        );

        clearInput();

        return;
    }


    const student =
        students.find(
            student =>
                String(student.code)
                === code
        );


    if (!student) {

        showError(
            "The Code Is Not Found"
        );

        clearInput();

        return;
    }


    const today =
        getToday();


    const isPresent =
        attendance.some(
            record =>
                String(record.code)
                    === code
                &&
                record.date
                    === today
        );


    if (!isPresent) {

        showError(
            `${student.name} is not registered today`
        );

        clearInput();

        return;
    }


    const confirmed =
        confirm(
            `Remove today's attendance for ${student.name}?`
        );


    if (!confirmed) {

        return;
    }


    if (!navigator.onLine) {

        showError(
            "Internet connection is required to remove attendance"
        );

        return;
    }


    try {

        removeAttendanceButton.disabled =
            true;


        message.innerHTML = `

            <div>
                Removing attendance...
            </div>

        `;


        const response =
            await jsonpRequest({

                action:
                    "remove",

                code:
                    code,

                date:
                    today

            });


        if (!response.success) {

            throw new Error(
                response.message
            );
        }


        attendance =
            attendance.filter(
                record => !(
                    String(record.code)
                        === code
                    &&
                    record.date
                        === today
                )
            );


        pendingAttendance =
            pendingAttendance.filter(
                record => !(
                    String(record.code)
                        === code
                    &&
                    record.date
                        === today
                )
            );


        saveLocalData();


        message.innerHTML = `

            <div class="success">

                ${student.name}

                <br>

                Attendance Removed Successfully

            </div>

        `;


        clearInput();

        refreshUI();


        await syncFromSheet();


    } catch (error) {

        console.error(error);


        showError(
            error.message
            ||
            "Could not remove attendance"
        );

    } finally {

        removeAttendanceButton.disabled =
            false;

    }

}

// ==========================================
// ERROR
// ==========================================

function showError(
    text
) {

    message.innerHTML = `

        <div class="error">

            ${text}

        </div>

    `;
}



// ==========================================
// INPUT
// ==========================================

function clearInput() {

    codeInput.value =
        "";

    codeInput.focus();
}



// ==========================================
// TOTAL TODAY
// ==========================================

function displayAttendanceCount() {

    const today =
        getToday();


    const codes =
        new Set(

            attendance

                .filter(
                    record =>
                        record.date
                        === today
                )

                .map(
                    record =>
                        String(
                            record.code
                        )
                )

        );


    attendanceCount
        .textContent =
            codes.size;
}



// ==========================================
// GRADE
// ==========================================

function displayGradeAttendance() {

    const today =
        getToday();


    const gradeStudents =
        students.filter(
            student =>
                student.grade
                === selectedGrade
        );


    const gradeAttendance =
        attendance.filter(
            record =>

                record.grade
                === selectedGrade

                &&

                record.date
                === today
        );


    const presentCodes =
        new Set(

            gradeAttendance.map(
                record =>
                    String(
                        record.code
                    )
            )

        );


    const total =
        gradeStudents.length;


    const present =
        presentCodes.size;


    const absent =
        Math.max(
            total - present,
            0
        );


    totalStudents.textContent =
        total;


    presentStudents.textContent =
        present;


    absentStudents.textContent =
        absent;

}



// ==========================================
// REFRESH UI
// ==========================================

function refreshUI() {

    displayAttendanceCount();

    displayGradeAttendance();
}



// ==========================================
// GRADE BUTTONS
// ==========================================

gradeButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            function() {

                selectedGrade =
                    button.dataset.grade;


                gradeButtons.forEach(
                    btn =>
                        btn.classList
                            .remove(
                                "active"
                            )
                );


                button.classList
                    .add(
                        "active"
                    );


                displayGradeAttendance();

            }
        );

    }
);

// ==========================================
// EVENTS
// ==========================================

attendanceButton
    .addEventListener(
        "click",
        registerAttendance
    );


codeInput
    .addEventListener(
        "keydown",
        function(event) {

            if (
                event.key
                === "Enter"
            ) {

                registerAttendance();

            }

        }
    );



// Internet returned

window.addEventListener(
    "online",
    runSync
);


// Internet lost

window.addEventListener(
    "offline",
    function() {

        setSyncStatus(
            "Offline - Attendance will sync later",
            "offline"
        );

    }
);


// App reopened

document.addEventListener(
    "visibilitychange",
    function() {

        if (
            !document.hidden
            &&
            navigator.onLine
        ) {

            runSync();

        }

    }
);

removeAttendanceButton
    .addEventListener(
        "click",
        removeAttendance
    );

// ==========================================
// START
// ==========================================

refreshUI();


if (
    navigator.onLine
) {

    runSync();

} else {

    setSyncStatus(
        "Offline - Using saved data",
        "offline"
    );

}



// ==========================================
// SERVICE WORKER
// ==========================================

if (
    "serviceWorker"
    in navigator
) {

    window.addEventListener(
        "load",
        function() {

            navigator.serviceWorker
                .register(
                    "./service-worker.js"
                );

        }
    );

}