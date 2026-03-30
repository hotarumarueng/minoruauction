package task_test

import (
	"testing"

	"github.com/toriumihotaru/minoru/internal/task"
)

func TestIsValidTransition_ValidCases(t *testing.T) {
	cases := []struct {
		from task.TaskStatus
		to   task.TaskStatus
	}{
		{task.StatusUnbid, task.StatusBid},
		{task.StatusBid, task.StatusRebid},
		{task.StatusBid, task.StatusWon},
		{task.StatusRebid, task.StatusBid},
	}
	for _, c := range cases {
		if !task.IsValidTransition(c.from, c.to) {
			t.Errorf("expected %q → %q to be valid", c.from, c.to)
		}
	}
}

func TestIsValidTransition_InvalidCases(t *testing.T) {
	cases := []struct {
		from task.TaskStatus
		to   task.TaskStatus
	}{
		{task.StatusWon, task.StatusBid},
		{task.StatusWon, task.StatusRebid},
		{task.StatusWon, task.StatusUnbid},
		{task.StatusUnbid, task.StatusRebid},
		{task.StatusUnbid, task.StatusWon},
		{task.StatusRebid, task.StatusUnbid},
		{task.StatusRebid, task.StatusWon},
	}
	for _, c := range cases {
		if task.IsValidTransition(c.from, c.to) {
			t.Errorf("expected %q → %q to be invalid", c.from, c.to)
		}
	}
}
