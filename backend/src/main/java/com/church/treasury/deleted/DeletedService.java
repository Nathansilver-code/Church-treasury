package com.church.treasury.deleted;

import com.church.treasury.repository.DeletedRepository;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class DeletedService {

    private final DeletedRepository repo;

    public DeletedService(DeletedRepository repo) {
        this.repo = repo;
    }

    /** Everything deleted, most recent first. */
    public List<DeletedEntry> all() {
        return repo.all().stream()
            .sorted(Comparator.comparing(DeletedEntry::deletedAt).reversed())
            .toList();
    }
}
