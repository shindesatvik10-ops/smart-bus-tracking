const { db } = require("../config/firebase");

// Mark passenger attendance
async function markAttendance(req, res, next) {
  try {
    const { passengerId, passengerName, driverUid, routeId, date, status } = req.body;

    if (!passengerId || !status) {
      return res.status(400).json({ success: false, message: "passengerId and status are required." });
    }

    const attendanceDate = date || new Date().toISOString().split("T")[0];
    const docId = `${attendanceDate}_${passengerId}`;

    const record = {
      passengerId,
      passengerName: passengerName || "",
      driverUid: driverUid || "",
      routeId: routeId || "",
      date: attendanceDate,
      status, // "present" or "absent"
      updatedAt: new Date().toISOString(),
    };

    if (db) {
      await db.collection("attendance").doc(docId).set(record, { merge: true });
    }

    return res.status(200).json({ success: true, message: "Attendance saved.", data: { id: docId, ...record } });
  } catch (err) {
    next(err);
  }
}

// Get attendance records
async function getAttendance(req, res, next) {
  try {
    const { date, driverUid, routeId } = req.query;

    if (db) {
      let query = db.collection("attendance");
      if (date) query = query.where("date", "==", date);
      if (driverUid) query = query.where("driverUid", "==", driverUid);
      if (routeId) query = query.where("routeId", "==", routeId);

      const snap = await query.limit(100).get();
      const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.json({ success: true, count: records.length, data: records });
    } else {
      return res.json({ success: true, count: 0, data: [] });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  markAttendance,
  getAttendance,
};
