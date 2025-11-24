import { supabase } from "../lib/supabaseClient";

/**
 * Получить общую статистику для админской аналитики
 */
export async function getAdminOverviewStats({ from = null, to = null } = {}) {
  // Всего учеников (без фильтра по периоду)
  const { data: allStudents, error: studentsError } = await supabase
    .from("students")
    .select("id", { count: "exact" });

  if (studentsError) throw studentsError;
  const totalStudentsCount = allStudents?.length || 0;

  // Уроки за период
  let lessonsQuery = supabase
    .from("lessons")
    .select("id, status, start_at, student_id");

  if (from) {
    lessonsQuery = lessonsQuery.gte("start_at", from);
  }
  if (to) {
    lessonsQuery = lessonsQuery.lte("start_at", to);
  }

  const { data: lessons, error: lessonsError } = await lessonsQuery;

  if (lessonsError) throw lessonsError;

  const totalLessons = lessons?.length || 0;
  const doneLessons = lessons?.filter((l) => l.status === "done")?.length || 0;
  const canceledLessons = lessons?.filter((l) => l.status === "canceled")?.length || 0;

  // Активные абонементы (на сегодня, без фильтра по периоду)
  const { data: activeSubscriptions, error: subsError } = await supabase
    .from("subscriptions")
    .select("id, active, end_at")
    .eq("active", true);

  if (subsError) throw subsError;

  // Фильтруем на клиенте: активный абонемент = active=true и (end_at IS NULL OR end_at >= now)
  const now = new Date();
  const activeSubscriptionsFiltered = (activeSubscriptions || []).filter((sub) => {
    if (!sub.active) return false;
    if (!sub.end_at) return true; // Без даты окончания = активен
    const endAt = new Date(sub.end_at);
    return endAt >= now; // Не истёкший
  });

  const activeSubscriptionsCount = activeSubscriptionsFiltered.length;

  // Выручка за период
  let revenueQuery = supabase
    .from("subscriptions")
    .select("id, created_at");

  if (from) {
    revenueQuery = revenueQuery.gte("created_at", from);
  }
  if (to) {
    revenueQuery = revenueQuery.lte("created_at", to);
  }

  const { data: periodSubscriptions, error: revenueError } = await revenueQuery;

  if (revenueError) throw revenueError;

  // TODO: добавить поле price/total_price в subscriptions
  const revenue = 0;
  const newSubscriptionsCount = periodSubscriptions?.length || 0;

  // Движение учеников за период
  let newStudentsQuery = supabase
    .from("students")
    .select("id, created_at");

  if (from) {
    newStudentsQuery = newStudentsQuery.gte("created_at", from);
  }
  if (to) {
    newStudentsQuery = newStudentsQuery.lte("created_at", to);
  }

  const { data: newStudents, error: newStudentsError } = await newStudentsQuery;
  if (newStudentsError) throw newStudentsError;

  const newStudentsCount = newStudents?.length || 0;

  // Ушедшие (абонемент закончился в период и не продлён)
  let endedSubsQuery = supabase
    .from("subscriptions")
    .select("id, end_at, active")
    .eq("active", false);

  if (from) {
    endedSubsQuery = endedSubsQuery.gte("end_at", from);
  }
  if (to) {
    endedSubsQuery = endedSubsQuery.lte("end_at", to);
  }

  const { data: endedSubs, error: endedSubsError } = await endedSubsQuery;
  if (endedSubsError) throw endedSubsError;

  const leftStudentsCount = endedSubs?.length || 0;

  return {
    totalStudentsCount,
    studentsCount: totalStudentsCount, // Для обратной совместимости
    activeSubscriptionsCount,
    totalLessons,
    doneLessons,
    canceledLessons,
    attendancePercent: doneLessons + canceledLessons > 0
      ? Math.round((doneLessons / (doneLessons + canceledLessons)) * 100)
      : 0,
    newSubscriptionsCount,
    revenue,
    newStudentsCount,
    leftStudentsCount,
  };
}

/**
 * Получить список активных абонементов
 */
export async function getActiveSubscriptions({ limit = 10, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      name,
      remaining_lessons,
      lessons_total,
      end_at,
      created_at,
      user_id,
      students:user_id(id, display_name, teacher_id)
    `,
      { count: "exact" }
    )
    .eq("active", true)
    .order("end_at", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  // Получаем данные преподавателей отдельно
  const studentIds = [...new Set((data || []).map((s) => s.students?.teacher_id).filter(Boolean))];
  let teachersMap = {};
  
  if (studentIds.length > 0) {
    const { data: teachers } = await supabase
      .from("teachers")
      .select("id, display_name")
      .in("id", studentIds);
    
    teachersMap = (teachers || []).reduce((acc, t) => {
      acc[t.id] = t;
      return acc;
    }, {});
  }

  // Обрабатываем данные для удобства
  const items = (data || []).map((sub) => {
    const student = Array.isArray(sub.students) ? sub.students[0] : sub.students;
    const teacher = student?.teacher_id ? teachersMap[student.teacher_id] : null;
    return {
      ...sub,
      students: student ? { ...student, teachers: teacher } : null,
    };
  });

  return {
    items,
    total: items.length,
  };
}

/**
 * Получить статистику по абонементам
 */
export async function getSubscriptionsStats({ from = null, to = null } = {}) {
  let query = supabase.from("subscriptions").select("id, active, end_at, created_at", { count: "exact" });

  if (from) {
    query = query.or(`created_at.gte.${from},end_at.gte.${from}`);
  }
  if (to) {
    query = query.or(`created_at.lte.${to},end_at.lte.${to}`);
  }

  const { data: allSubscriptions, error } = await query;

  if (error) throw error;

  const total = allSubscriptions?.length || 0;
  const active = allSubscriptions?.filter((s) => s.active === true)?.length || 0;
  const completed = allSubscriptions?.filter((s) => s.active === false)?.length || 0;

  // Скоро заканчиваются (в ближайшие 7 дней)
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringSoon = allSubscriptions?.filter(
    (s) => s.active && s.end_at && new Date(s.end_at) <= in7Days && new Date(s.end_at) >= now
  )?.length || 0;

  // Студенты без абонемента
  const { data: allStudents, error: studentsError } = await supabase
    .from("students")
    .select("id");

  if (studentsError) throw studentsError;

  const { data: studentsWithSubs, error: subsError } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("active", true);

  if (subsError) throw subsError;

  const studentsWithSubsIds = new Set(studentsWithSubs?.map((s) => s.user_id) || []);
  const studentsWithoutSubs = (allStudents?.length || 0) - studentsWithSubsIds.size;

  return {
    total,
    active,
    completed,
    expiringSoon,
    studentsWithoutSubs: Math.max(0, studentsWithoutSubs),
  };
}

/**
 * Получить список абонементов с фильтрами
 */
export async function getSubscriptionsList({
  status = "all", // 'all' | 'active' | 'completed' | 'expiring'
  limit = 20,
  offset = 0,
  from = null,
  to = null,
} = {}) {
  let query = supabase
    .from("subscriptions")
    .select(
      `
      id,
      name,
      active,
      remaining_lessons,
      lessons_total,
      created_at,
      end_at,
      user_id,
      students:user_id(id, display_name, teacher_id)
    `,
      { count: "exact" }
    );

  // Фильтр по статусу
  if (status === "active") {
    query = query.eq("active", true);
  } else if (status === "completed") {
    query = query.eq("active", false);
  } else if (status === "expiring") {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    query = query
      .eq("active", true)
      .gte("end_at", now.toISOString())
      .lte("end_at", in7Days.toISOString());
  }

  // Фильтр по периоду
  if (from) {
    query = query.or(`created_at.gte.${from},end_at.gte.${from}`);
  }
  if (to) {
    query = query.or(`created_at.lte.${to},end_at.lte.${to}`);
  }

  query = query.order("end_at", { ascending: true, nullsFirst: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  // Получаем данные преподавателей отдельно
  const studentIds = [...new Set((data || []).map((s) => s.students?.teacher_id).filter(Boolean))];
  let teachersMap = {};
  
  if (studentIds.length > 0) {
    const { data: teachers } = await supabase
      .from("teachers")
      .select("id, display_name")
      .in("id", studentIds);
    
    teachersMap = (teachers || []).reduce((acc, t) => {
      acc[t.id] = t;
      return acc;
    }, {});
  }

  // Обрабатываем данные для удобства
  const items = (data || []).map((sub) => {
    const student = Array.isArray(sub.students) ? sub.students[0] : sub.students;
    const teacher = student?.teacher_id ? teachersMap[student.teacher_id] : null;
    return {
      ...sub,
      students: student ? { ...student, teachers: teacher } : null,
    };
  });

  return {
    items,
    total: count || 0,
  };
}

/**
 * Получить статистику по преподавателям
 */
export async function getTeachersStats({ from = null, to = null } = {}) {
  let lessonsQuery = supabase.from("lessons").select("teacher_id, status, duration_min, start_at");

  if (from) {
    lessonsQuery = lessonsQuery.gte("start_at", from);
  }
  if (to) {
    lessonsQuery = lessonsQuery.lte("start_at", to);
  }

  const { data: lessons, error: lessonsError } = await lessonsQuery;

  if (lessonsError) throw lessonsError;

  // Группируем по преподавателям
  const teacherStats = {};
  const teacherStudentIds = {};

  lessons?.forEach((lesson) => {
    if (!lesson.teacher_id) return;

    if (!teacherStats[lesson.teacher_id]) {
      teacherStats[lesson.teacher_id] = {
        teacherId: lesson.teacher_id,
        lessonsCount: 0,
        hoursCount: 0,
      };
      teacherStudentIds[lesson.teacher_id] = new Set();
    }

    teacherStats[lesson.teacher_id].lessonsCount++;
    if (lesson.duration_min) {
      teacherStats[lesson.teacher_id].hoursCount += lesson.duration_min / 60;
    }
    if (lesson.student_id) {
      teacherStudentIds[lesson.teacher_id].add(lesson.student_id);
    }
  });

  // Получаем данные преподавателей
  const teacherIds = Object.keys(teacherStats);
  if (teacherIds.length === 0) {
    return [];
  }

  const { data: teachers, error: teachersError } = await supabase
    .from("teachers")
    .select("id, display_name")
    .in("id", teacherIds);

  if (teachersError) throw teachersError;

  // Объединяем данные
  const result = teachers?.map((teacher) => {
    const stats = teacherStats[teacher.id] || { lessonsCount: 0, hoursCount: 0 };
    const studentsCount = teacherStudentIds[teacher.id]?.size || 0;

    // Определяем нагрузку (упрощённо)
    let workload = "низкая";
    if (stats.lessonsCount >= 20) workload = "высокая";
    else if (stats.lessonsCount >= 10) workload = "средняя";

    return {
      ...teacher,
      studentsCount,
      lessonsCount: stats.lessonsCount,
      hoursCount: Math.round(stats.hoursCount * 10) / 10,
      workload,
    };
  }) || [];

  // Получаем общую статистику
  const { data: allTeachers, error: allTeachersError } = await supabase
    .from("teachers")
    .select("id", { count: "exact" });

  if (allTeachersError) throw allTeachersError;

  const totalTeachers = allTeachers?.length || 0;
  const teachersWithStudents = result.length;
  const teachersWithoutStudents = totalTeachers - teachersWithStudents;

  return {
    teachers: result,
    totalTeachers,
    teachersWithStudents,
    teachersWithoutStudents,
  };
}

/**
 * Получить статистику по занятиям
 */
export async function getLessonsStats({
  status = "all", // 'all' | 'planned' | 'done' | 'canceled'
  className = null,
  teacherId = null,
  from = null,
  to = null,
} = {}) {
  let query = supabase.from("lessons").select("id, status, start_at, class_name, teacher_id", { count: "exact" });

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (className) {
    query = query.eq("class_name", className);
  }
  if (teacherId) {
    query = query.eq("teacher_id", teacherId);
  }
  if (from) {
    query = query.gte("start_at", from);
  }
  if (to) {
    query = query.lte("start_at", to);
  }

  const { data: lessons, error } = await query;

  if (error) throw error;

  const total = lessons?.length || 0;
  const done = lessons?.filter((l) => l.status === "done")?.length || 0;
  const canceled = lessons?.filter((l) => l.status === "canceled")?.length || 0;
  const planned = lessons?.filter((l) => l.status === "planned")?.length || 0;

  const attendancePercent = done + canceled > 0 ? Math.round((done / (done + canceled)) * 100) : 0;

  return {
    total,
    done,
    canceled,
    planned,
    attendancePercent,
  };
}

/**
 * Получить график посещаемости по дням
 */
export async function getAttendanceChartData({ from = null, to = null, className = null } = {}) {
  let query = supabase.from("lessons").select("id, status, start_at, class_name");

  if (className) {
    query = query.eq("class_name", className);
  }
  if (from) {
    query = query.gte("start_at", from);
  }
  if (to) {
    query = query.lte("start_at", to);
  }

  const { data: lessons, error } = await query;

  if (error) throw error;

  // Группируем по дням
  const dayStats = {};

  lessons?.forEach((lesson) => {
    const date = new Date(lesson.start_at);
    const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

    if (!dayStats[dateKey]) {
      dayStats[dateKey] = { date: dateKey, done: 0, canceled: 0, total: 0 };
    }

    dayStats[dateKey].total++;
    if (lesson.status === "done") {
      dayStats[dateKey].done++;
    } else if (lesson.status === "canceled") {
      dayStats[dateKey].canceled++;
    }
  });

  // Преобразуем в массив и сортируем
  const result = Object.values(dayStats)
    .map((day) => ({
      ...day,
      attendancePercent: day.done + day.canceled > 0 ? Math.round((day.done / (day.done + day.canceled)) * 100) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return result;
}

/**
 * Получить статистику по выручке
 */
export async function getRevenueStats({ from = null, to = null, subscriptionType = null } = {}) {
  let query = supabase.from("subscriptions").select("id, name, created_at");

  if (subscriptionType && subscriptionType !== "all") {
    query = query.eq("name", subscriptionType);
  }
  if (from) {
    query = query.gte("created_at", from);
  }
  if (to) {
    query = query.lte("created_at", to);
  }

  const { data: subscriptions, error } = await query;

  if (error) throw error;

  const newSubscriptionsCount = subscriptions?.length || 0;

  // Если в subscriptions есть поле price/total_price, используем его
  // Пока возвращаем количество
  const revenue = 0; // TODO: добавить поле price в subscriptions

  return {
    revenue,
    newSubscriptionsCount,
    averageCheck: newSubscriptionsCount > 0 ? revenue / newSubscriptionsCount : 0,
  };
}

/**
 * Получить график выручки по периодам
 */
export async function getRevenueChartData({ from = null, to = null } = {}) {
  let query = supabase.from("subscriptions").select("id, created_at");

  if (from) {
    query = query.gte("created_at", from);
  }
  if (to) {
    query = query.lte("created_at", to);
  }

  const { data: subscriptions, error } = await query;

  if (error) throw error;

  // Группируем по дням
  const dayStats = {};

  subscriptions?.forEach((sub) => {
    const date = new Date(sub.created_at);
    const dateKey = date.toISOString().split("T")[0];

    if (!dayStats[dateKey]) {
      dayStats[dateKey] = { date: dateKey, count: 0, revenue: 0 };
    }

    dayStats[dateKey].count++;
    // TODO: добавить revenue когда будет поле price
  });

  const result = Object.values(dayStats)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      ...day,
      date: day.date,
    }));

  return result;
}

/**
 * Получить список доступных уровней/классов
 */
export async function getAvailableClassNames() {
  const { data, error } = await supabase.from("lessons").select("class_name").not("class_name", "is", null);

  if (error) throw error;

  const uniqueClasses = [...new Set(data?.map((l) => l.class_name).filter(Boolean) || [])].sort();

  return uniqueClasses;
}

/**
 * Получить список студентов с аналитикой для админки
 */
export async function getAdminStudentsAnalytics({
  from = null,
  to = null,
  className = null,
  subscriptionStatus = "all", // 'all' | 'with' | 'without' | 'expiring'
  limit = 50,
  offset = 0,
} = {}) {
  // Получаем всех студентов
  let studentsQuery = supabase
    .from("students")
    .select("id, display_name, teacher_id, user_id");

  const { data: allStudents, error: studentsError } = await studentsQuery;

  if (studentsError) throw studentsError;

  // Получаем email из v_users_full
  const userIds = [...new Set((allStudents || []).map((s) => s.user_id || s.id).filter(Boolean))];
  let usersMap = {};

  if (userIds.length > 0) {
    try {
      const { data: users } = await supabase
        .from("v_users_full")
        .select("id, email")
        .in("id", userIds);

      usersMap = (users || []).reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
      }, {});
    } catch (e) {
      // Если RLS не позволяет читать v_users_full — просто пропускаем
      console.warn("Could not fetch emails from v_users_full:", e);
    }
  }

  // Получаем уроки за период
  let lessonsQuery = supabase
    .from("lessons")
    .select("id, student_id, status, start_at, class_name");

  if (from) {
    lessonsQuery = lessonsQuery.gte("start_at", from);
  }
  if (to) {
    lessonsQuery = lessonsQuery.lte("start_at", to);
  }
  if (className) {
    lessonsQuery = lessonsQuery.eq("class_name", className);
  }

  const { data: lessons, error: lessonsError } = await lessonsQuery;
  if (lessonsError) throw lessonsError;

  // Получаем ДЗ за период
  const studentIds = (allStudents || []).map((s) => s.id);
  const { data: assignmentTargets } = await supabase
    .from("assignment_targets")
    .select("assignment_id, student_id")
    .in("student_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

  const assignmentIds = [...new Set((assignmentTargets || []).map((at) => at.assignment_id))];

  let assignmentsQuery = supabase
    .from("assignments")
    .select("id, created_at")
    .in("id", assignmentIds.length > 0 ? assignmentIds : ["00000000-0000-0000-0000-000000000000"]);

  if (from) {
    assignmentsQuery = assignmentsQuery.gte("created_at", from);
  }
  if (to) {
    assignmentsQuery = assignmentsQuery.lte("created_at", to);
  }

  const { data: assignments, error: assignmentsError } = await assignmentsQuery;
  if (assignmentsError) throw assignmentsError;

  let submissionsQuery = supabase
    .from("submissions")
    .select("id, student_id, assignment_id, grade, created_at")
    .in("student_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

  if (from) {
    submissionsQuery = submissionsQuery.gte("created_at", from);
  }
  if (to) {
    submissionsQuery = submissionsQuery.lte("created_at", to);
  }

  const { data: submissions, error: submissionsError } = await submissionsQuery;
  if (submissionsError) throw submissionsError;

  // Получаем абонементы
  const { data: subscriptions, error: subsError } = await supabase
    .from("subscriptions")
    .select("id, user_id, active, end_at");

  if (subsError) throw subsError;

  // Получаем преподавателей
  const teacherIds = [...new Set((allStudents || []).map((s) => s.teacher_id).filter(Boolean))];
  let teachersMap = {};

  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from("teachers")
      .select("id, display_name")
      .in("id", teacherIds);

    teachersMap = (teachers || []).reduce((acc, t) => {
      acc[t.id] = t;
      return acc;
    }, {});
  }

  // Агрегируем данные по студентам
  const studentsData = (allStudents || []).map((student) => {
    const studentLessons = (lessons || []).filter((l) => l.student_id === student.id);
    const doneLessons = studentLessons.filter((l) => l.status === "done").length;
    const plannedLessons = studentLessons.filter((l) => l.status === "planned").length;
    const totalLessons = doneLessons + plannedLessons;
    const attendancePercent =
      totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

    const studentAssignments = (assignmentTargets || []).filter(
      (at) => at.student_id === student.id
    );
    const assignmentIdsForStudent = studentAssignments.map((at) => at.assignment_id);
    const periodAssignments = (assignments || []).filter((a) =>
      assignmentIdsForStudent.includes(a.id)
    );
    const totalAssignments = periodAssignments.length;

    const studentSubmissions = (submissions || []).filter((s) => s.student_id === student.id);
    const completedAssignments = new Set(studentSubmissions.map((s) => s.assignment_id)).size;
    const homeworkPercent =
      totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

    const grades = studentSubmissions
      .map((s) => {
        const g =
          typeof s.grade === "string"
            ? parseFloat(s.grade.replace(",", "."))
            : typeof s.grade === "number"
            ? s.grade
            : NaN;
        return Number.isFinite(g) ? g : null;
      })
      .filter((g) => g !== null);

    const averageGrade =
      grades.length > 0
        ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 10) / 10
        : null;

    // Определяем уровень (из уроков)
    const studentClassNames = [...new Set(studentLessons.map((l) => l.class_name).filter(Boolean))];
    const studentClassName = studentClassNames.length > 0 ? studentClassNames[0] : null;

    // Статус абонемента
    const studentSubs = (subscriptions || []).filter((s) => s.user_id === student.user_id);
    const activeSub = studentSubs.find((s) => s.active === true);
    let subscriptionStatusText = "нет абонемента";
    if (activeSub) {
      const endAt = activeSub.end_at ? new Date(activeSub.end_at) : null;
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (endAt && endAt <= in7Days && endAt >= now) {
        subscriptionStatusText = "скоро заканчивается";
      } else if (endAt && endAt < now) {
        subscriptionStatusText = "завершён";
      } else {
        subscriptionStatusText = "активен";
      }
    } else if (studentSubs.length > 0) {
      subscriptionStatusText = "завершён";
    }

    return {
      id: student.id,
      display_name: student.display_name,
      email: usersMap[student.user_id || student.id]?.email || null,
      className: studentClassName,
      teacher: teachersMap[student.teacher_id] || null,
      doneLessons,
      totalLessons,
      attendancePercent,
      averageGrade,
      completedAssignments,
      totalAssignments,
      homeworkPercent,
      subscriptionStatus: subscriptionStatusText,
    };
  });

  // Фильтруем по статусу абонемента
  let filtered = studentsData;
  if (subscriptionStatus === "with") {
    filtered = filtered.filter((s) => s.subscriptionStatus === "активен");
  } else if (subscriptionStatus === "without") {
    filtered = filtered.filter((s) => s.subscriptionStatus === "нет абонемента");
  } else if (subscriptionStatus === "expiring") {
    filtered = filtered.filter((s) => s.subscriptionStatus === "скоро заканчивается");
  }

  // Фильтруем по уровню
  if (className) {
    filtered = filtered.filter((s) => s.className === className);
  }

  // Пагинация
  const paginated = filtered.slice(offset, offset + limit);

  return {
    items: paginated,
    total: filtered.length,
  };
}

/**
 * Получить расширенную статистику по преподавателям
 */
export async function getAdminTeachersAnalytics({
  from = null,
  to = null,
  workloadFilter = "all", // 'all' | 'low' | 'normal' | 'high'
  hasStudents = "all", // 'all' | 'with' | 'without'
} = {}) {
  // Получаем всех преподавателей
  const { data: allTeachers, error: teachersError } = await supabase
    .from("teachers")
    .select("id, display_name");

  if (teachersError) throw teachersError;

  // Получаем уроки за период
  let lessonsQuery = supabase
    .from("lessons")
    .select("id, teacher_id, student_id, status, start_at, duration_min");

  if (from) {
    lessonsQuery = lessonsQuery.gte("start_at", from);
  }
  if (to) {
    lessonsQuery = lessonsQuery.lte("start_at", to);
  }

  const { data: lessons, error: lessonsError } = await lessonsQuery;
  if (lessonsError) throw lessonsError;

  // Получаем студентов с активными абонементами
  const { data: activeSubs } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("active", true);

  const activeStudentUserIds = new Set((activeSubs || []).map((s) => s.user_id));

  const { data: students } = await supabase.from("students").select("id, user_id, teacher_id");

  const activeStudentIds = new Set(
    (students || [])
      .filter((s) => activeStudentUserIds.has(s.user_id))
      .map((s) => s.id)
  );

  // Агрегируем по преподавателям
  const teachersData = (allTeachers || []).map((teacher) => {
    const teacherLessons = (lessons || []).filter((l) => l.teacher_id === teacher.id);
    const doneLessons = teacherLessons.filter((l) => l.status === "done").length;
    const plannedLessons = teacherLessons.filter((l) => l.status === "planned").length;
    const canceledLessons = teacherLessons.filter((l) => l.status === "canceled").length;

    const hoursCount =
      teacherLessons
        .filter((l) => l.status === "done")
        .reduce((sum, l) => sum + (l.duration_min || 0) / 60, 0) || 0;

    const studentIds = new Set(teacherLessons.map((l) => l.student_id).filter(Boolean));
    const activeStudentsCount = [...studentIds].filter((id) => activeStudentIds.has(id)).length;

    // Средняя посещаемость учеников
    const studentAttendance = {};
    teacherLessons.forEach((l) => {
      if (!l.student_id) return;
      if (!studentAttendance[l.student_id]) {
        studentAttendance[l.student_id] = { done: 0, planned: 0 };
      }
      if (l.status === "done") studentAttendance[l.student_id].done++;
      if (l.status === "planned") studentAttendance[l.student_id].planned++;
    });

    const attendancePercents = Object.values(studentAttendance)
      .map((stats) => {
        const total = stats.done + stats.planned;
        return total > 0 ? (stats.done / total) * 100 : 0;
      })
      .filter((p) => p > 0);

    const avgAttendance =
      attendancePercents.length > 0
        ? Math.round(
            (attendancePercents.reduce((a, b) => a + b, 0) / attendancePercents.length) * 10
          ) / 10
        : 0;

    // Определяем нагрузку
    let workload = "низкая";
    if (hoursCount >= 15) workload = "высокая";
    else if (hoursCount >= 5) workload = "нормальная";

    return {
      ...teacher,
      activeStudentsCount,
      doneLessons,
      plannedLessons,
      canceledLessons,
      hoursCount: Math.round(hoursCount * 10) / 10,
      avgAttendance,
      workload,
    };
  });

  // Фильтруем
  let filtered = teachersData;
  if (workloadFilter === "low") {
    filtered = filtered.filter((t) => t.workload === "низкая");
  } else if (workloadFilter === "normal") {
    filtered = filtered.filter((t) => t.workload === "нормальная");
  } else if (workloadFilter === "high") {
    filtered = filtered.filter((t) => t.workload === "высокая");
  }

  if (hasStudents === "with") {
    filtered = filtered.filter((t) => t.activeStudentsCount > 0);
  } else if (hasStudents === "without") {
    filtered = filtered.filter((t) => t.activeStudentsCount === 0);
  }

  return {
    teachers: filtered,
    totalTeachers: allTeachers?.length || 0,
    teachersWithStudents: teachersData.filter((t) => t.activeStudentsCount > 0).length,
    teachersWithoutStudents: teachersData.filter((t) => t.activeStudentsCount === 0).length,
  };
}

/**
 * Получить статистику по успеваемости
 */
export async function getAdminPerformanceStats({ from = null, to = null } = {}) {
  // Получаем всех студентов
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, display_name, teacher_id, user_id");

  if (studentsError) throw studentsError;

  const studentIds = (students || []).map((s) => s.id);

  // Получаем ДЗ за период
  const { data: assignmentTargets } = await supabase
    .from("assignment_targets")
    .select("assignment_id, student_id")
    .in("student_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

  const assignmentIds = [...new Set((assignmentTargets || []).map((at) => at.assignment_id))];

  let assignmentsQuery = supabase
    .from("assignments")
    .select("id, created_at")
    .in("id", assignmentIds.length > 0 ? assignmentIds : ["00000000-0000-0000-0000-000000000000"]);

  if (from) {
    assignmentsQuery = assignmentsQuery.gte("created_at", from);
  }
  if (to) {
    assignmentsQuery = assignmentsQuery.lte("created_at", to);
  }

  const { data: assignments, error: assignmentsError } = await assignmentsQuery;
  if (assignmentsError) throw assignmentsError;

  // Получаем сабмишены
  let submissionsQuery = supabase
    .from("submissions")
    .select("id, student_id, assignment_id, grade, created_at")
    .in("student_id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

  if (from) {
    submissionsQuery = submissionsQuery.gte("created_at", from);
  }
  if (to) {
    submissionsQuery = submissionsQuery.lte("created_at", to);
  }

  const { data: submissions, error: submissionsError } = await submissionsQuery;
  if (submissionsError) throw submissionsError;

  // Получаем уроки для посещаемости
  let lessonsQuery = supabase
    .from("lessons")
    .select("id, student_id, status, start_at, class_name");

  if (from) {
    lessonsQuery = lessonsQuery.gte("start_at", from);
  }
  if (to) {
    lessonsQuery = lessonsQuery.lte("start_at", to);
  }

  const { data: lessons, error: lessonsError } = await lessonsQuery;
  if (lessonsError) throw lessonsError;

  // Получаем email из v_users_full
  const userIds = [...new Set((students || []).map((s) => s.user_id || s.id).filter(Boolean))];
  let usersMap = {};

  if (userIds.length > 0) {
    try {
      const { data: users } = await supabase
        .from("v_users_full")
        .select("id, email")
        .in("id", userIds);

      usersMap = (users || []).reduce((acc, u) => {
        acc[u.id] = u;
        return acc;
      }, {});
    } catch (e) {
      // Если RLS не позволяет читать v_users_full — просто пропускаем
      console.warn("Could not fetch emails from v_users_full:", e);
    }
  }

  // Получаем преподавателей
  const teacherIds = [...new Set((students || []).map((s) => s.teacher_id).filter(Boolean))];
  let teachersMap = {};

  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from("teachers")
      .select("id, display_name")
      .in("id", teacherIds);

    teachersMap = (teachers || []).reduce((acc, t) => {
      acc[t.id] = t;
      return acc;
    }, {});
  }

  // Агрегируем по студентам
  const studentsStats = (students || []).map((student) => {
    const studentLessons = (lessons || []).filter((l) => l.student_id === student.id);
    const doneLessons = studentLessons.filter((l) => l.status === "done").length;
    const plannedLessons = studentLessons.filter((l) => l.status === "planned").length;
    const totalLessons = doneLessons + plannedLessons;
    const attendancePercent =
      totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

    const studentAssignments = (assignmentTargets || []).filter(
      (at) => at.student_id === student.id
    );
    const assignmentIdsForStudent = studentAssignments.map((at) => at.assignment_id);
    const periodAssignments = (assignments || []).filter((a) =>
      assignmentIdsForStudent.includes(a.id)
    );
    const totalAssignments = periodAssignments.length;

    const studentSubmissions = (submissions || []).filter((s) => s.student_id === student.id);
    const completedAssignments = new Set(studentSubmissions.map((s) => s.assignment_id)).size;
    const homeworkPercent =
      totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

    const grades = studentSubmissions
      .map((s) => {
        const g =
          typeof s.grade === "string"
            ? parseFloat(s.grade.replace(",", "."))
            : typeof s.grade === "number"
            ? s.grade
            : NaN;
        return Number.isFinite(g) ? g : null;
      })
      .filter((g) => g !== null);

    const averageGrade =
      grades.length > 0
        ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 10) / 10
        : null;

    // Определяем уровень
    const studentClassNames = [...new Set(studentLessons.map((l) => l.class_name).filter(Boolean))];
    const studentClassName = studentClassNames.length > 0 ? studentClassNames[0] : null;

    // Определяем причины риска
    const riskReasons = [];
    if (averageGrade !== null && averageGrade < 70) riskReasons.push("низкая оценка");
    if (homeworkPercent < 60) riskReasons.push("низкое ДЗ");
    if (attendancePercent < 70) riskReasons.push("низкая посещаемость");

    const isAtRisk = riskReasons.length > 0;
    const isHighPerformer =
      (averageGrade !== null && averageGrade >= 90) && homeworkPercent >= 90;

    return {
      id: student.id,
      display_name: student.display_name,
      email: usersMap[student.user_id || student.id]?.email || null,
      className: studentClassName,
      teacher: teachersMap[student.teacher_id] || null,
      averageGrade,
      homeworkPercent,
      attendancePercent,
      riskReasons,
      isAtRisk,
      isHighPerformer,
    };
  });

  // Общая статистика
  const allGrades = studentsStats
    .map((s) => s.averageGrade)
    .filter((g) => g !== null);
  const platformAverageGrade =
    allGrades.length > 0
      ? Math.round((allGrades.reduce((a, b) => a + b, 0) / allGrades.length) * 10) / 10
      : null;

  const allHomeworkPercents = studentsStats.map((s) => s.homeworkPercent);
  const platformHomeworkPercent =
    allHomeworkPercents.length > 0
      ? Math.round(
          (allHomeworkPercents.reduce((a, b) => a + b, 0) / allHomeworkPercents.length) * 10
        ) / 10
      : 0;

  const atRiskCount = studentsStats.filter((s) => s.isAtRisk).length;
  const highPerformerCount = studentsStats.filter((s) => s.isHighPerformer).length;

  // Распределение оценок
  const gradeDistribution = {
    "0-59": 0,
    "60-69": 0,
    "70-79": 0,
    "80-89": 0,
    "90-100": 0,
  };

  allGrades.forEach((grade) => {
    if (grade < 60) gradeDistribution["0-59"]++;
    else if (grade < 70) gradeDistribution["60-69"]++;
    else if (grade < 80) gradeDistribution["70-79"]++;
    else if (grade < 90) gradeDistribution["80-89"]++;
    else gradeDistribution["90-100"]++;
  });

  return {
    platformAverageGrade,
    platformHomeworkPercent,
    atRiskCount,
    highPerformerCount,
    atRiskStudents: studentsStats.filter((s) => s.isAtRisk),
    gradeDistribution,
  };
}

